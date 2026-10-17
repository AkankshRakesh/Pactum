#!/usr/bin/env bash
set -Eeuo pipefail

exec > >(tee -a /var/log/pactum-monitoring-setup.log) 2>&1

REGION="${AWS_REGION:-ap-south-1}"
GRAFANA_SECRET_ARN="${1:?Usage: $0 <grafana-secret-arn> <backend-ip-1> <backend-ip-2>}"

PROMETHEUS_IMAGE="prom/prometheus:v3.5.0"
GRAFANA_IMAGE="grafana/grafana:12.2.0"
ROOT_DIR="/opt/pactum-monitoring"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

if [[ $# -ne 3 ]]; then
    die "Usage: $0 <grafana-secret-arn> <backend-private-ip-1> <backend-private-ip-2>"
fi

GRAFANA_SECRET_ARN="$1"
BACKEND_IP_1="$2"
BACKEND_IP_2="$3"

validate_ipv4() {
    local ip="$1"
    local octet
    local parts

    [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
    IFS='.' read -r -a parts <<< "$ip"

    for octet in "${parts[@]}"; do
        (( 10#$octet <= 255 )) || return 1
    done
}

validate_ipv4 "$BACKEND_IP_1" ||
    die "Invalid backend IP: $BACKEND_IP_1"
validate_ipv4 "$BACKEND_IP_2" ||
    die "Invalid backend IP: $BACKEND_IP_2"

export DEBIAN_FRONTEND=noninteractive

# Wait for first-boot cloud-init to finish before using apt/dpkg.
if command -v cloud-init >/dev/null 2>&1; then
    cloud-init status --wait || true
fi

apt-get update
apt-get install -y docker.io jq ca-certificates curl unzip
systemctl enable --now docker

# Install AWS CLI v2 from the official installer, not apt.
if [[ ! -x /usr/local/bin/aws ]]; then
    curl -fsSL \
      "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
      -o /tmp/awscliv2.zip

    rm -rf /tmp/aws
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install --update

    rm -rf /tmp/aws /tmp/awscliv2.zip
fi

AWS="/usr/local/bin/aws"
"$AWS" --version
docker --version

# Retrieve the Grafana password without printing it to the logs.
SECRET_JSON="$("$AWS" secretsmanager get-secret-value \
    --secret-id "$GRAFANA_SECRET_ARN" \
    --query SecretString \
    --output text \
    --region "$REGION")"

GRAFANA_ADMIN_PASSWORD="$(
    printf '%s' "$SECRET_JSON" |
    jq -er '.password | strings | select(length > 0)'
)" || die "Secret must be JSON containing a non-empty .password field."

unset SECRET_JSON

install -d -m 0750 "$ROOT_DIR/prometheus"
install -d -m 0750 "$ROOT_DIR/grafana-provisioning/datasources"
install -d -m 0750 "$ROOT_DIR/grafana-provisioning/dashboards"
install -d -m 0750 "$ROOT_DIR/dashboards"
install -d -m 0750 "$ROOT_DIR/secrets"

printf '%s' "$GRAFANA_ADMIN_PASSWORD" \
    > "$ROOT_DIR/secrets/grafana_admin_password"

chown 472:472 "$ROOT_DIR/secrets/grafana_admin_password"
chmod 0400 "$ROOT_DIR/secrets/grafana_admin_password"

unset GRAFANA_ADMIN_PASSWORD

# Use the actual backend IPs from CloudFormation outputs.
cat > "$ROOT_DIR/prometheus/prometheus.yml" <<PROMETHEUS_CONFIG
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: pactum-backend-1
    static_configs:
      - targets: ["${BACKEND_IP_1}:9100"]

  - job_name: pactum-backend-2
    static_configs:
      - targets: ["${BACKEND_IP_2}:9100"]
PROMETHEUS_CONFIG

# Automatically configure the Grafana Prometheus datasource.
cat > "$ROOT_DIR/grafana-provisioning/datasources/prometheus.yml" <<'DATASOURCE'
apiVersion: 1
datasources:
  - name: Prometheus
    uid: pactum-prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
DATASOURCE

# Provision a dashboard automatically.
cat > "$ROOT_DIR/grafana-provisioning/dashboards/provider.yml" <<'PROVIDER'
apiVersion: 1
providers:
  - name: Pactum
    orgId: 1
    folder: Pactum
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
PROVIDER

cat > "$ROOT_DIR/dashboards/pactum-node-overview.json" <<'DASHBOARD'
{
  "id": null,
  "uid": "pactum-node-overview",
  "title": "Pactum - Node Overview",
  "tags": ["pactum"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "15s",
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "panels": [
    {
      "id": 1,
      "type": "timeseries",
      "title": "CPU Usage (%)",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "datasource": {"type": "prometheus", "uid": "pactum-prometheus"},
      "targets": [
        {
          "expr": "100 * (1 - avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])))",
          "legendFormat": "{{instance}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {"unit": "percent", "min": 0, "max": 100},
        "overrides": []
      },
      "options": {
        "legend": {"displayMode": "list", "placement": "bottom"},
        "tooltip": {"mode": "multi"}
      }
    },
    {
      "id": 2,
      "type": "timeseries",
      "title": "Memory Usage (%)",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "datasource": {"type": "prometheus", "uid": "pactum-prometheus"},
      "targets": [
        {
          "expr": "100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)",
          "legendFormat": "{{instance}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {"unit": "percent", "min": 0, "max": 100},
        "overrides": []
      },
      "options": {
        "legend": {"displayMode": "list", "placement": "bottom"},
        "tooltip": {"mode": "multi"}
      }
    },
    {
      "id": 3,
      "type": "timeseries",
      "title": "Node Exporter Availability",
      "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8},
      "datasource": {"type": "prometheus", "uid": "pactum-prometheus"},
      "targets": [
        {
          "expr": "up{job=~\"pactum-backend-.*\"}",
          "legendFormat": "{{job}} ({{instance}})",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {"unit": "short", "min": 0, "max": 1},
        "overrides": []
      },
      "options": {
        "legend": {"displayMode": "list", "placement": "bottom"},
        "tooltip": {"mode": "multi"}
      }
    }
  ]
}
DASHBOARD

# Create the network and volumes if they do not exist.
docker network inspect pactum-monitoring >/dev/null 2>&1 ||
    docker network create pactum-monitoring

docker volume create prometheus-data >/dev/null
docker volume create grafana-data >/dev/null

docker pull "$PROMETHEUS_IMAGE"
docker pull "$GRAFANA_IMAGE"

# Recreate containers but preserve their persistent data volumes.
docker rm -f prometheus grafana >/dev/null 2>&1 || true

docker run -d \
    --name prometheus \
    --restart unless-stopped \
    --network pactum-monitoring \
    -p 127.0.0.1:9090:9090 \
    -v "$ROOT_DIR/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
    -v prometheus-data:/prometheus \
    "$PROMETHEUS_IMAGE" \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --storage.tsdb.retention.time=15d

docker run -d \
    --name grafana \
    --restart unless-stopped \
    --network pactum-monitoring \
    -p 127.0.0.1:3000:3000 \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/grafana_admin_password \
    -e GF_USERS_ALLOW_SIGN_UP=false \
    -v grafana-data:/var/lib/grafana \
    -v "$ROOT_DIR/secrets/grafana_admin_password:/run/secrets/grafana_admin_password:ro" \
    -v "$ROOT_DIR/grafana-provisioning:/etc/grafana/provisioning:ro" \
    -v "$ROOT_DIR/dashboards:/var/lib/grafana/dashboards:ro" \
    "$GRAFANA_IMAGE"

# Do not report success until both services answer their health endpoints.
for attempt in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:9090/-/ready >/dev/null &&
       curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
        echo "MONITORING_SETUP_READY"
        docker ps --filter name=prometheus --filter name=grafana
        exit 0
    fi
    sleep 5
done

echo "Prometheus logs:"
docker logs --tail 100 prometheus || true
echo "Grafana logs:"
docker logs --tail 100 grafana || true
die "Prometheus and Grafana did not become healthy within five minutes."