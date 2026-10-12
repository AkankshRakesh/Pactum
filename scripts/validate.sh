#!/usr/bin/env bash
set -Eeuo pipefail
aws cloudformation validate-template --template-body file://infra/cloudformation/pactum.yaml
python -m compileall backend
