pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 90, unit: 'MINUTES')
    }

    environment {
        AWS_DEFAULT_REGION = 'ap-southeast-2'
        STACK_NAME         = 'pactum-backend'
        AWS_CREDS          = credentials('aws-creds')    // AWS_CREDS_USR / AWS_CREDS_PSW
        DOCKERHUB          = credentials('docker-hub')   // DOCKERHUB_USR / DOCKERHUB_PSW
        IMAGE              = "${DOCKERHUB_USR}/pactum-backend:latest"
    }

    stages {
        stage('Checkout and Validate') {
            steps {
                checkout scm
                ps('''
                    foreach ($f in @(
                        'backend/Dockerfile',
                        'infra/cloudformation/pactum-backend.yaml',
                        'infra/deploy/kubernetes/backend-service.yaml',
                        'infra/deploy/kubernetes/backend-deployment.yaml',
                        'infra/deploy/kubernetes/django-migration-job.yaml',
                        'infra/scripts/setup-monitoring.sh'
                    )) {
                        if (-not (Test-Path $f)) { throw "Missing required file: $f" }
                    }
                ''')
            }
        }

        stage('Build and Push Image') {
            steps {
                ps('''
                    $tmp = Join-Path $env:TEMP ('docker-' + [guid]::NewGuid().ToString('N'))
                    try {
                        [IO.File]::WriteAllText($tmp, $env:DOCKERHUB_PSW.Trim(), [Text.UTF8Encoding]::new($false))

                        cmd /c "docker login -u $($env:DOCKERHUB_USR.Trim()) --password-stdin < `"$tmp`""
                        if ($LASTEXITCODE -ne 0) { throw 'Docker Hub login failed.' }

                        docker build -t $env:IMAGE backend
                        if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }

                        docker push $env:IMAGE
                        if ($LASTEXITCODE -ne 0) { throw 'Docker push failed.' }
                    }
                    finally {
                        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
                    }
                ''')
            }
        }

        stage('Provision Infrastructure') {
            steps {
                script {
                    def out = ps('''
                        Invoke-Aws cloudformation deploy --stack-name $env:STACK_NAME --template-file infra/cloudformation/pactum-backend.yaml --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset

                        $outs = (Invoke-Aws cloudformation describe-stacks --stack-name $env:STACK_NAME --query 'Stacks[0].Outputs' --output json | Out-String) | ConvertFrom-Json

                        $map = [ordered]@{
                            PACTUM_INSTANCE_IDS          = 'InstanceIds'
                            PACTUM_ALB_DNS               = 'LoadBalancerDNS'
                            PACTUM_PRIVATE_IPS           = 'InstancePrivateIps'
                            PACTUM_MONITORING_INSTANCE_ID = 'MonitoringInstanceId'
                            PACTUM_GRAFANA_SECRET_ARN    = 'GrafanaAdminSecretArn'
                        }
                        foreach ($k in $map.Keys) {
                            $v = ($outs | Where-Object { $_.OutputKey -eq $map[$k] }).OutputValue
                            if (-not $v) { throw "Missing stack output: $($map[$k])" }
                            "$k=$v"
                        }
                    ''', true)

                    echo out
                    for (line in out.readLines()) {
                        if (line.startsWith('PACTUM_')) {
                            def p = line.split('=', 2)
                            env."${p[0]}" = p[1].trim()
                        }
                    }
                    echo "ALB: http://${env.PACTUM_ALB_DNS}"
                }
            }
        }

        stage('Wait for Nodes') {
            steps {
                ps('''
                    Invoke-Ssm ($env:PACTUM_INSTANCE_IDS.Split(',')) @(
                        'cloud-init status --wait || true',
                        '/usr/local/bin/k3s kubectl wait --for=condition=Ready node --all --timeout=180s',
                        'systemctl is-active k3s'
                    ) 300
                ''')
            }
        }

        stage('Install Node Exporter') {
            steps {
                ps('''
                    $body = @'
set -eu
V=1.9.1
D="$(mktemp -d)"
curl -fsSL "https://github.com/prometheus/node_exporter/releases/download/v$V/node_exporter-$V.linux-amd64.tar.gz" | tar -xz -C "$D" --strip-components=1
install -m 0755 "$D/node_exporter" /usr/local/bin/node_exporter
rm -rf "$D"
id node_exporter >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter
cat > /etc/systemd/system/node_exporter.service <<'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9100
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable node_exporter
systemctl restart node_exporter
curl -fsS --retry 5 --retry-connrefused --retry-delay 2 http://127.0.0.1:9100/metrics >/dev/null
echo "node_exporter running on :9100"
'@
                    Invoke-Ssm ($env:PACTUM_INSTANCE_IDS.Split(',')) @($body) 300
                ''')
            }
        }

        stage('Configure Monitoring') {
            steps {
                ps('''
                    $ips  = $env:PACTUM_PRIVATE_IPS.Split(',')
                    $text = (Get-Content 'infra/scripts/setup-monitoring.sh' -Raw) -replace "`r`n", "`n"
                    $b64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))

                    # Ship the script as base64 chunks, rebuild it on the instance, run it with bash.
                    $cmds  = @('cloud-init status --wait >/dev/null 2>&1 || true', 'rm -f /tmp/mon.b64')
                    $cmds += [regex]::Matches($b64, '.{1,3000}') | ForEach-Object { "printf '%s' '$($_.Value)' >> /tmp/mon.b64" }
                    $cmds += 'base64 -d /tmp/mon.b64 > /tmp/mon.sh'
                    $cmds += "/bin/bash /tmp/mon.sh '$env:PACTUM_GRAFANA_SECRET_ARN' '$($ips[0])' '$($ips[1])'"
                    $cmds += 'rm -f /tmp/mon.b64 /tmp/mon.sh'

                    Invoke-Ssm @($env:PACTUM_MONITORING_INSTANCE_ID) $cmds 900
                ''')
            }
        }

        stage('Deploy Backend') {
            environment {
                SUPABASE_DB_PASSWORD = credentials('pactum-db-password')
                DJANGO_SECRET_KEY    = credentials('pactum-django-secret-key')
                SMTP_USER            = credentials('pactum-email-host-user')
                SMTP_PASSWORD        = credentials('pactum-email-host-password')
            }
            steps {
                ps('''
                    function B64($s) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }
                    function Manifest($f) { Get-Content "infra/deploy/kubernetes/$f" -Raw }

                    $hosts      = "$env:PACTUM_ALB_DNS,$env:PACTUM_PRIVATE_IPS,localhost,127.0.0.1"
                    $smtpUser   = $env:SMTP_USER.Trim()
                    $service    = Manifest 'backend-service.yaml'
                    $job        = (Manifest 'django-migration-job.yaml').Replace('BACKEND_IMAGE_PLACEHOLDER', $env:IMAGE)
                    $deployment = (Manifest 'backend-deployment.yaml').Replace('BACKEND_IMAGE_PLACEHOLDER', $env:IMAGE).Replace('ALLOWED_HOSTS_PLACEHOLDER', $hosts)

                    $template = @'
set -eu
k() { /usr/local/bin/k3s kubectl "$@"; }
d() { printf '%s' "$1" | base64 -d; }

k create namespace pactum --dry-run=client -o yaml | k apply -f -

SMTP_USER="$(d __SMTP_USER__)"
k -n pactum create secret generic pactum-app-secrets --from-literal=DB_PASSWORD="$(d __DB__)" --from-literal=DJANGO_SECRET_KEY="$(d __DJANGO__)" --dry-run=client -o yaml | k apply -f -
k -n pactum create secret generic pactum-smtp-secrets --from-literal=EMAIL_HOST_USER="$SMTP_USER" --from-literal=EMAIL_HOST_PASSWORD="$(d __SMTP_PASS__)" --dry-run=client -o yaml | k apply -f -

k -n pactum apply -f - <<'MANIFEST'
__SERVICE__
MANIFEST

if [ "__MIGRATE__" = true ]; then
    k -n pactum delete job pactum-migrate --ignore-not-found
    k -n pactum apply -f - <<'MANIFEST'
__JOB__
MANIFEST
    k -n pactum wait --for=condition=complete job/pactum-migrate --timeout=600s || { k -n pactum logs job/pactum-migrate --all-containers; k -n pactum get pods; exit 1; }
fi

k -n pactum apply -f - <<'MANIFEST'
__DEPLOYMENT__
MANIFEST

k -n pactum set env deployment/pactum-backend --from=secret/pactum-smtp-secrets
k -n pactum set env deployment/pactum-backend EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend EMAIL_HOST=smtp.gmail.com EMAIL_PORT=587 EMAIL_USE_TLS=True EMAIL_TIMEOUT=20 "DEFAULT_FROM_EMAIL=$SMTP_USER" DJANGO_DEBUG=False
k -n pactum rollout restart deployment/pactum-backend
k -n pactum rollout status deployment/pactum-backend --timeout=300s || { k -n pactum get pods -o wide; k -n pactum logs -l app=pactum-backend --all-containers --prefix --tail=100; exit 1; }
k -n pactum get pods -o wide
echo "Deployment complete"
'@

                    $template = $template.Replace('__SERVICE__', $service).Replace('__JOB__', $job).Replace('__DEPLOYMENT__', $deployment)
                    $template = $template.Replace('__DB__', (B64 $env:SUPABASE_DB_PASSWORD)).Replace('__DJANGO__', (B64 $env:DJANGO_SECRET_KEY))
                    $template = $template.Replace('__SMTP_USER__', (B64 $smtpUser)).Replace('__SMTP_PASS__', (B64 $env:SMTP_PASSWORD))

                    $ids = $env:PACTUM_INSTANCE_IDS.Split(',')
                    for ($i = 0; $i -lt $ids.Count; $i++) {
                        # Shared Supabase database: run migrations on the first instance only.
                        $migrate = ($i -eq 0).ToString().ToLower()
                        Write-Host "Deploying to $($ids[$i]) (migrations: $migrate)"
                        Invoke-Ssm @($ids[$i]) @($template.Replace('__MIGRATE__', $migrate)) 900
                    }

                    Write-Host "Backend: http://$env:PACTUM_ALB_DNS"
                ''')
            }
        }
    }
}

def ps(String body, boolean capture = false) {
    return powershell(returnStdout: capture, script: helpers() + body)
}

def helpers() {
    return '''
        $ErrorActionPreference = 'Stop'
        $env:AWS_ACCESS_KEY_ID     = $env:AWS_CREDS_USR
        $env:AWS_SECRET_ACCESS_KEY = $env:AWS_CREDS_PSW

        function Invoke-Aws {
            $out = & aws @args
            if ($LASTEXITCODE -ne 0) { throw "aws $($args -join ' ') failed." }
            $out
        }

        function Wait-Ssm([string]$Id) {
            for ($i = 0; $i -lt 60; $i++) {
                $s = & aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$Id" --query 'InstanceInformationList[0].PingStatus' --output text 2>$null
                if ($LASTEXITCODE -eq 0 -and "$s".Trim() -eq 'Online') { return }
                Start-Sleep -Seconds 10
            }
            throw "Instance $Id never became Online in SSM."
        }

        function Invoke-Ssm([string[]]$Ids, [string[]]$Commands, [int]$Timeout = 300) {
            foreach ($id in $Ids) { Wait-Ssm $id }

            $cmds = @('set -e') + ($Commands | ForEach-Object { $_ -replace "`r`n", "`n" })
            $file = Join-Path $env:TEMP ('ssm-' + [guid]::NewGuid().ToString('N') + '.json')
            try {
                $json = @{
                    InstanceIds    = $Ids
                    DocumentName   = 'AWS-RunShellScript'
                    Parameters     = @{ commands = $cmds }
                    TimeoutSeconds = $Timeout
                } | ConvertTo-Json -Depth 5 -Compress
                [IO.File]::WriteAllText($file, $json, [Text.UTF8Encoding]::new($false))

                $cmdId = (Invoke-Aws ssm send-command --cli-input-json "file://$file" --query Command.CommandId --output text | Out-String).Trim()
            }
            finally {
                Remove-Item $file -Force -ErrorAction SilentlyContinue
            }

            foreach ($id in $Ids) {
                $status = 'Pending'
                for ($i = 0; $i -lt ($Timeout / 5 + 6); $i++) {
                    Start-Sleep -Seconds 5
                    $s = & aws ssm get-command-invocation --command-id $cmdId --instance-id $id --query Status --output text 2>$null
                    if ($LASTEXITCODE -ne 0) { continue }
                    $status = "$s".Trim()
                    if ($status -in @('Success', 'Failed', 'Cancelled', 'TimedOut', 'Cancelling')) { break }
                }

                $stdout = & aws ssm get-command-invocation --command-id $cmdId --instance-id $id --query StandardOutputContent --output text
                Write-Host ($stdout -join "`n")

                if ($status -ne 'Success') {
                    $stderr = & aws ssm get-command-invocation --command-id $cmdId --instance-id $id --query StandardErrorContent --output text
                    throw "SSM command failed on $id ($status): $($stderr -join "`n")"
                }
            }
        }
    '''
}