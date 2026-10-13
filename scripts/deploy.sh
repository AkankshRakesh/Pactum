#!/usr/bin/env bash
set -Eeuo pipefail
: "${AWS_REGION:?}" "${STACK_NAME:?}" "${CLUSTER_NAME:?}" "${BACKEND_IMAGE:?}" "${FRONTEND_IMAGE:?}" "${IMAGE_TAG:?}" "${DJANGO_SECRET_KEY:?}"
: "${DJANGO_ALLOWED_HOSTS:=*}"
: "${CSRF_TRUSTED_ORIGINS:=}"
: "${NEXT_PUBLIC_API_BASE_URL:=/api}"
: "${ACM_CERTIFICATE_ARN:=}"

out="$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json)"
DB_HOST="$(printf '%s' "$out" | jq -r '.[] | select(.OutputKey=="DbEndpoint") | .OutputValue')"
DB_PORT="$(printf '%s' "$out" | jq -r '.[] | select(.OutputKey=="DbPort") | .OutputValue')"
DB_NAME="$(printf '%s' "$out" | jq -r '.[] | select(.OutputKey=="DbName") | .OutputValue')"
DB_SECRET_ARN="$(printf '%s' "$out" | jq -r '.[] | select(.OutputKey=="DbSecretArn") | .OutputValue')"
S3_BUCKET="$(printf '%s' "$out" | jq -r '.[] | select(.OutputKey=="ContractsBucketName") | .OutputValue')"
DB_JSON="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DB_SECRET_ARN" --query SecretString --output text)"
DB_USER="$(printf '%s' "$DB_JSON" | jq -r .username)"
DB_PASSWORD="$(printf '%s' "$DB_JSON" | jq -r .password)"
kubectl create namespace pactum --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic pactum-app-secrets -n pactum \
  --from-literal=DJANGO_SECRET_KEY="$DJANGO_SECRET_KEY" \
  --from-literal=DJANGO_DEBUG=False \
  --from-literal=DJANGO_ALLOWED_HOSTS="$DJANGO_ALLOWED_HOSTS" \
  --from-literal=CSRF_TRUSTED_ORIGINS="$CSRF_TRUSTED_ORIGINS" \
  --from-literal=DB_NAME="$DB_NAME" \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DB_HOST="$DB_HOST" \
  --from-literal=DB_PORT="$DB_PORT" \
  --from-literal=DB_SSLMODE=require \
  --dry-run=client -o yaml | kubectl apply -f -
# Never print the database password or secret JSON.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for f in namespace backend-deployment backend-service frontend-deployment frontend-service backend-hpa frontend-hpa ingress django-migration-job; do
  sed \
    -e "s|BACKEND_IMAGE_PLACEHOLDER|${BACKEND_IMAGE}:${IMAGE_TAG}|g" \
    -e "s|FRONTEND_IMAGE_PLACEHOLDER|${FRONTEND_IMAGE}:${IMAGE_TAG}|g" \
    -e "s|AWS_REGION_PLACEHOLDER|${AWS_REGION}|g" \
    -e "s|S3_BUCKET_PLACEHOLDER|${S3_BUCKET}|g" \
    "deploy/kubernetes/${f}.yaml" > "$tmp/${f}.yaml"
done
if [ -n "$ACM_CERTIFICATE_ARN" ]; then
  sed -i \
    -e 's|LISTEN_PORTS_PLACEHOLDER|[{"HTTP":80},{"HTTPS":443}]|g' \
    -e "s|CERTIFICATE_ARN_PLACEHOLDER|${ACM_CERTIFICATE_ARN}|g" \
    -e "/alb.ingress.kubernetes.io\/certificate-arn/a\    alb.ingress.kubernetes.io/ssl-redirect: '443'" \
    "$tmp/ingress.yaml"
else
  sed -i \
    -e 's|LISTEN_PORTS_PLACEHOLDER|[{"HTTP":80}]|g' \
    -e 's|CERTIFICATE_ARN_PLACEHOLDER||g' \
    "$tmp/ingress.yaml"
fi
kubectl apply -f "$tmp/namespace.yaml"
# Run migration job once per immutable image tag, replacing any completed/failed prior Job.
kubectl delete job pactum-migrate -n pactum --ignore-not-found
kubectl apply -f "$tmp/django-migration-job.yaml"
kubectl wait --for=condition=complete job/pactum-migrate -n pactum --timeout=10m
kubectl apply -f "$tmp/backend-service.yaml" "$tmp/frontend-service.yaml"
kubectl apply -f "$tmp/backend-deployment.yaml" "$tmp/frontend-deployment.yaml"
kubectl apply -f "$tmp/backend-hpa.yaml" "$tmp/frontend-hpa.yaml" "$tmp/ingress.yaml"
kubectl rollout status deployment/pactum-backend -n pactum --timeout=5m
kubectl rollout status deployment/pactum-frontend -n pactum --timeout=5m
kubectl get ingress,deployments,pods,services,hpa -n pactum
