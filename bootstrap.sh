#!/usr/bin/env bash
set -Eeuo pipefail

: "${AWS_REGION:?Set AWS_REGION, e.g. ap-south-1}"
: "${STACK_NAME:=pactum}"
: "${CLUSTER_NAME:=pactum-eks}"
: "${DB_NAME:=pactum}"
: "${DB_USERNAME:=pactumadmin}"
: "${DB_INSTANCE_CLASS:=db.t3.micro}"
: "${NODE_INSTANCE_TYPES:=t3.medium}"
: "${DESIRED_NODES:=2}"
: "${MAX_NODES:=3}"
: "${S3_BUCKET_NAME:?Set a globally unique S3_BUCKET_NAME}"
: "${EKS_PUBLIC_ACCESS_CIDRS:=}"
: "${ACM_CERTIFICATE_ARN:=}"
: "${EKS_VERSION:=1.33}"

command -v aws >/dev/null || { echo "aws CLI v2 is required"; exit 1; }
aws sts get-caller-identity >/dev/null
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
TEMPLATE="infra/cloudformation/pactum.yaml"
test -f "$TEMPLATE" || { echo "Run from repository root; missing $TEMPLATE"; exit 1; }

CIDRS="${EKS_PUBLIC_ACCESS_CIDRS:-$(curl -fsS https://checkip.amazonaws.com | tr -d '\n')/32}"
PARAMS=(
  "ParameterKey=ClusterName,ParameterValue=${CLUSTER_NAME}"
  "ParameterKey=KubernetesVersion,ParameterValue=${EKS_VERSION}"
  "ParameterKey=DbName,ParameterValue=${DB_NAME}"
  "ParameterKey=DbUsername,ParameterValue=${DB_USERNAME}"
  "ParameterKey=DbInstanceClass,ParameterValue=${DB_INSTANCE_CLASS}"
  "ParameterKey=NodeInstanceTypes,ParameterValue=${NODE_INSTANCE_TYPES}"
  "ParameterKey=DesiredNodes,ParameterValue=${DESIRED_NODES}"
  "ParameterKey=MaxNodes,ParameterValue=${MAX_NODES}"
  "ParameterKey=ContractsBucketName,ParameterValue=${S3_BUCKET_NAME}"
  "ParameterKey=EksPublicAccessCidrs,ParameterValue=${CIDRS}"
  "ParameterKey=AcmCertificateArn,ParameterValue=${ACM_CERTIFICATE_ARN}"
)
echo "Deploying CloudFormation stack ${STACK_NAME} in ${AWS_REGION}, account ${ACCOUNT_ID}"
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "${PARAMS[@]}" \
  --no-fail-on-empty-changeset

aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output table
echo "Infrastructure deployment complete. Run the Jenkins pipeline to build and deploy application images."
