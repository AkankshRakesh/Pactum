# Kubernetes and ALB setup

1. Jenkins runs `scripts/install-addons.sh`, which installs the AWS Load Balancer Controller using Helm and IRSA. It requires `eksctl`, Helm, curl, and IAM permissions to create/update a scoped controller policy and OIDC service account. Review and pin the upstream controller policy/version before production.
2. The `ingress.yaml` expects the controller and ALB ingress class `alb` to exist. Apply it only after controller setup.
3. The baseline Ingress listens on HTTP/80. If `ACM_CERTIFICATE_ARN` is supplied to Jenkins, the deploy script configures an HTTPS/443 listener and redirects HTTP to HTTPS. Set a real domain/Route 53 alias and ensure the certificate is issued in the same region.
4. The `pactum-backend` and `pactum-frontend` Services are ClusterIP. ALB target type `ip` routes to pod IPs.
5. HPA needs the Kubernetes metrics API, normally `metrics-server` on EKS. Confirm `kubectl top pods -n pactum` works.
6. Django must implement `/healthz/`, allow the public host in `ALLOWED_HOSTS`, set `CSRF_TRUSTED_ORIGINS`, and use `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` behind HTTPS ingress.
7. Next.js standalone output requires `output: 'standalone'` in `frontend/next.config.ts`. If `public/` does not exist, adjust the Dockerfile's `COPY` command.
8. If frontend server-side requests need the internal backend, use an internal base URL such as `http://pactum-backend.pactum.svc.cluster.local:8000`; browser-side calls must use a public/same-origin URL.
9. For simplicity, the baseline grants the node role access to only the configured contracts bucket. For stronger isolation, replace this with an IRSA/EKS Pod Identity role scoped to the Django service account.
