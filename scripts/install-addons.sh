#!/usr/bin/env bash
set -Eeuo pipefail
: "${AWS_REGION:?}" "${CLUSTER_NAME:?}"
command -v aws >/dev/null
command -v kubectl >/dev/null
command -v helm >/dev/null
command -v eksctl >/dev/null || { echo "eksctl is required for the controller IAM service account setup"; exit 1; }
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_NAME="AWSLoadBalancerControllerIAMPolicy-${CLUSTER_NAME}"
POLICY_FILE="$(mktemp)"
trap 'rm -f "$POLICY_FILE"' EXIT
# Review the upstream policy and pin a tested controller version for production.
curl -fsSL https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json -o "$POLICY_FILE"
if aws iam get-policy --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}" >/dev/null 2>&1; then
  aws iam create-policy-version --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}" --policy-document "file://${POLICY_FILE}" --set-as-default
else
  aws iam create-policy --policy-name "$POLICY_NAME" --policy-document "file://${POLICY_FILE}" >/dev/null
fi
eksctl utils associate-iam-oidc-provider --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --approve
if ! eksctl get iamserviceaccount --cluster "$CLUSTER_NAME" --region "$AWS_REGION" | grep -q aws-load-balancer-controller; then
  eksctl create iamserviceaccount \
    --cluster "$CLUSTER_NAME" --region "$AWS_REGION" \
    --namespace kube-system --name aws-load-balancer-controller \
    --attach-policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}" \
    --approve --override-existing-serviceaccounts
fi
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName="$CLUSTER_NAME" \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --wait --timeout 10m
kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=5m
