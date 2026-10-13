# Pactum AWS deployment

This is a deployment scaffold for the Pactum repository:
- `backend/`: Django + Gunicorn
- `frontend/`: Next.js
- AWS CloudFormation: VPC, EKS, managed node group, RDS PostgreSQL, S3, IAM, and AWS Load Balancer Controller prerequisites
- Existing Jenkins server: runs `Jenkinsfile`
- Docker Hub: versioned backend/frontend images
- Kubernetes: Deployments, Services, HPA, ALB Ingress, migration Job, optional monitoring chart

## Important assumptions to verify before first deployment

1. The repository root contains `backend/` and `frontend/` exactly as described.
2. Django is configured by environment variables listed in `backend/.env.example`; update `backend/pactum/settings.py` to read these values. The scaffold expects `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_SSLMODE`, `AWS_STORAGE_BUCKET_NAME`, and `AWS_REGION`.
3. The app has or will add `/healthz/` in Django and `/api/health` (or equivalent) in Next.js. Adjust probes to match actual endpoints.
4. Frontend backend API base URL is `NEXT_PUBLIC_API_BASE_URL`. For browser traffic, prefer a same-origin `/api` route or a public HTTPS API hostname; `http://backend:8000` is only valid from inside the cluster and is not usable by browsers.
5. Django uses PostgreSQL in production. The CloudFormation stack creates RDS PostgreSQL and its credentials in Secrets Manager. Migrations run as a Kubernetes Job.
6. This stack creates a small public/private subnet topology with one NAT Gateway for a simplified baseline. NAT, EKS, RDS, ALB, EC2 and data transfer incur costs. For production, use multi-AZ private subnets and at least two NAT gateways, which increases cost.
7. Set `ACM_CERTIFICATE_ARN` to a valid ACM certificate in the same region for HTTPS. Without it, the scaffold can use HTTP temporarily; do not expose sensitive production traffic over plain HTTP.
8. Existing Jenkins must have AWS CLI v2, kubectl, Helm, Docker, jq, Python 3 and permission to access the AWS account. Docker daemon access is required.
9. CloudFormation cannot safely roll back a database schema after an application migration. Use backward-compatible migrations and keep previous image tags.
10. This is a scaffold, not a substitute for reviewing your actual settings, CORS/CSRF, auth, uploads, and database schema. Test in a non-production AWS account first.

## Files

- `bootstrap.sh`: validates inputs and deploys CloudFormation stacks. It does not install Jenkins because Jenkins already exists.
- `Jenkinsfile`: test, build, scan, push, provision/update infrastructure, configure EKS, deploy, migrate, verify, and best-effort application rollback.
- `infra/cloudformation/pactum.yaml`: single baseline stack for network, EKS, node group, RDS, S3, Secrets Manager, and IAM.
- `backend/Dockerfile`, `frontend/Dockerfile`: copy these into the application directories.
- `deploy/kubernetes/`: Kubernetes resources and optional monitoring values.
- `scripts/`: deployment helper scripts.

## Bootstrap

From the repository root, copy these files into the corresponding paths, then:

```bash
chmod +x bootstrap.sh scripts/*.sh
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export STACK_NAME=pactum
export CLUSTER_NAME=pactum-eks
export DB_NAME=pactum
export DB_USERNAME=pactumadmin
export DB_INSTANCE_CLASS=db.t3.micro
export NODE_INSTANCE_TYPES=t3.medium
export DESIRED_NODES=2
export MAX_NODES=3
export S3_BUCKET_NAME="pactum-contracts-${AWS_ACCOUNT_ID}-${AWS_REGION}"
./bootstrap.sh
```

CloudFormation creates the RDS password in Secrets Manager. Capture stack outputs, and configure Jenkins credentials:
- `aws-deploy-role` or AWS credentials available to the Jenkins agent (prefer instance profile / assumed role)
- `dockerhub-credentials` as username/password credential
- `pactum-django-secret-key` as Secret text
- `pactum-dockerhub-user` as Secret text, if your image names need a separate username

Set Jenkins job parameters/environment:
- `AWS_REGION`, `STACK_NAME`, `CLUSTER_NAME`
- `DOCKERHUB_USERNAME`
- `BACKEND_IMAGE`, `FRONTEND_IMAGE` (e.g. `dockerhub-user/pactum-backend`)
- `DOMAIN_NAME` (optional)
- `ACM_CERTIFICATE_ARN` (optional; must be supplied during bootstrap for HTTPS)
- `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL` (publicly reachable URL or same-origin API path)

## Security and operations

- Do not commit `.env`, Django secret keys, database passwords, Docker Hub tokens, AWS access keys, or kubeconfig.
- Prefer a Jenkins EC2 instance profile or OIDC/assume-role over static AWS access keys.
- Restrict Jenkins inbound access to VPN/known IPs; do not expose port 8080 to the world.
- RDS is private and accepts connections only from the EKS node security group.
- S3 public access is blocked; configure Django storage access using workload IAM (IRSA/EKS Pod Identity) before enabling direct S3 uploads.
- The basic stack's workload-to-S3 IAM role association is a follow-up hardening step because it depends on your cluster OIDC/provider setup. Do not put long-lived AWS keys in Kubernetes Secrets.
- The ALB controller needs an IAM policy and service account role. Install it using the official AWS Load Balancer Controller policy for your cluster version; see `deploy/kubernetes/README.md`.
- EKS endpoint access is public in this baseline, restricted by `EKS_PUBLIC_ACCESS_CIDRS`. Set this to your office/VPN/Jenkins egress CIDRs, not `0.0.0.0/0`, for production.
