#!/usr/bin/env bash
set -Eeuo pipefail
kubectl rollout status deployment/pactum-backend -n pactum --timeout=180s
kubectl rollout status deployment/pactum-frontend -n pactum --timeout=180s
kubectl get pods -n pactum
kubectl get ingress -n pactum
