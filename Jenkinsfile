
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')
    }

    environment {
        AWS_REGION = 'ap-south-1'
        AWS_DEFAULT_REGION = 'ap-south-1'
        STACK_NAME = 'pactum-backend'
        INSTANCE_TYPE = 'c7i-flex.large'
        MONITORING_INSTANCE_TYPE = 'c7i-flex.large'
        K8S_NAMESPACE = 'pactum'
        VERCEL_ORIGIN = 'https://pactum-sable.vercel.app'
        GITHUB_REPO = 'https://github.com/AkankshRakesh/Pactum.git'
    }

    stages {
        stage('Checkout and Validate') {
            steps {
                checkout scm

                script {
                    env.GIT_COMMIT_FULL = powershell(
                        returnStdout: true,
                        script: 'git rev-parse HEAD'
                    ).trim()
                    
                    env.IMAGE_TAG = 'latest'

                    if (!env.GIT_COMMIT_FULL) {
                        error('Could not determine Git commit SHA.')
                    }
                }

                powershell '''
                    $ErrorActionPreference = 'Stop'

                    foreach ($tool in @('aws', 'docker', 'git')) {
                        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
                            throw "Missing required tool: $tool"
                        }
                    }

                    foreach ($path in @(
                        'backend/manage.py',
                        'backend/Dockerfile',
                        'backend/requirements.txt',
                        'infra/cloudformation/pactum-backend.yaml',
                        'deploy/kubernetes/backend-service.yaml',
                        'deploy/kubernetes/backend-deployment.yaml',
                        'deploy/kubernetes/django-migration-job.yaml',
                        'infra/scripts/setup-monitoring.sh'
                    )) {
                        if (-not (Test-Path $path)) {
                            throw "Missing required file: $path"
                        }
                    }

                    docker info 2>&1 | Out-Null
                    if ($LASTEXITCODE -ne 0) {
                        throw 'Docker is unavailable.'
                    }
                '''
            }
        }

        stage('Build and Push Backend Image') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKERHUB_USER',
                        passwordVariable: 'DOCKERHUB_PASS'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        $user = $env:DOCKERHUB_USER.Trim()
                        $pass = $env:DOCKERHUB_PASS.Trim()

                        if (-not $user -or -not $pass) {
                            throw 'Docker Hub credentials are empty.'
                        }

                        $tmp = Join-Path $env:TEMP (
                            'docker-' + [guid]::NewGuid().ToString('N')
                        )

                        try {
                            [IO.File]::WriteAllText(
                                $tmp, $pass,
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            cmd /c "docker login -u $user --password-stdin < `"$tmp`""
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Docker Hub login failed.'
                            }

                            $image = "$user/pactum-backend:$env:IMAGE_TAG"

                            docker build -t $image backend
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Docker build failed.'
                            }

                            docker push $image
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Docker push failed.'
                            }

                            Write-Host "Published $image"
                        }
                        finally {
                            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
                            docker logout 2>&1 | Out-Null
                        }
                    '''
                }
            }
        }

        stage('Provision Infrastructure') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    script {
                        def result = powershell(
                            returnStdout: true,
                            script: '''
                                $ErrorActionPreference = 'Stop'

                                & aws sts get-caller-identity `
                                    --region $env:AWS_REGION | Out-Null
                                if ($LASTEXITCODE -ne 0) {
                                    throw 'AWS authentication failed.'
                                }

                                & aws cloudformation deploy `
                                    --region $env:AWS_REGION `
                                    --stack-name $env:STACK_NAME `
                                    --template-file infra/cloudformation/pactum-backend.yaml `
                                    --capabilities CAPABILITY_NAMED_IAM `
                                    --parameter-overrides `
                                        "InstanceType=$env:INSTANCE_TYPE" `
                                        "MonitoringInstanceType=$env:MONITORING_INSTANCE_TYPE" `
                                    --no-fail-on-empty-changeset

                                if ($LASTEXITCODE -ne 0) {
                                    throw 'CloudFormation deployment failed.'
                                }

                                $raw = & aws cloudformation describe-stacks `
                                    --region $env:AWS_REGION `
                                    --stack-name $env:STACK_NAME `
                                    --query "Stacks[0].Outputs" `
                                    --output json

                                if ($LASTEXITCODE -ne 0) {
                                    throw 'Could not read CloudFormation outputs.'
                                }

                                $outputs = @{}
                                foreach ($item in ($raw | ConvertFrom-Json)) {
                                    $outputs[$item.OutputKey] = $item.OutputValue
                                }

                                if (-not $outputs.InstanceIds -or
                                    -not $outputs.LoadBalancerDNS -or
                                    -not $outputs.InstancePrivateIps -or
                                    -not $outputs.MonitoringInstanceId) {
                                    throw 'Missing required CloudFormation outputs.'
                                }

                                Write-Output "INSTANCE_IDS=$($outputs.InstanceIds)"
                                Write-Output "ALB_DNS=$($outputs.LoadBalancerDNS)"
                                Write-Output "INSTANCE_PRIVATE_IPS=$($outputs.InstancePrivateIps)"
                                Write-Output "MONITORING_INSTANCE_ID=$($outputs.MonitoringInstanceId)"
                            '''
                        ).trim()

                        def instanceIdsLine = result.readLines().find {
                            it.startsWith('INSTANCE_IDS=')
                        }
                        def albLine = result.readLines().find {
                            it.startsWith('ALB_DNS=')
                        }
                        def privateIpsLine = result.readLines().find {
                            it.startsWith('INSTANCE_PRIVATE_IPS=')
                        }

                        if (!instanceIdsLine || !albLine || !privateIpsLine) {
                            error("Could not parse CloudFormation outputs: ${result}")
                        }

                        def monitoringLine = result.readLines().find {
                            it.startsWith('MONITORING_INSTANCE_ID=')
                        }

                        if (!monitoringLine) {
                            error("Could not parse MonitoringInstanceId from CloudFormation outputs: ${result}")
                        }

                        env.PACTUM_MONITORING_INSTANCE_ID =
                            monitoringLine.substring('MONITORING_INSTANCE_ID='.length())


                        env.PACTUM_INSTANCE_IDS =
                            instanceIdsLine.substring('INSTANCE_IDS='.length())
                        env.PACTUM_ALB_DNS =
                            albLine.substring('ALB_DNS='.length())
                        env.PACTUM_PRIVATE_IPS =
                            privateIpsLine.substring('INSTANCE_PRIVATE_IPS='.length())

                        echo "Monitoring EC2 instance: ${env.PACTUM_MONITORING_INSTANCE_ID}"
                        echo "EC2 instances: ${env.PACTUM_INSTANCE_IDS}"
                        echo "Private IPs: ${env.PACTUM_PRIVATE_IPS}"
                        echo "ALB: http://${env.PACTUM_ALB_DNS}"
                    }
                }
            }
        }

        stage('Wait for SSM and k3s') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        $instanceIds = $env:PACTUM_INSTANCE_IDS.Split(',')

                        foreach ($instanceId in $instanceIds) {
                            $instanceId = $instanceId.Trim()
                            Write-Host "Waiting for SSM: $instanceId"

                            $online = $false
                            for ($i = 0; $i -lt 60; $i++) {
                                $status = & aws ssm describe-instance-information `
                                    --region $env:AWS_REGION `
                                    --filters "Key=InstanceIds,Values=$instanceId" `
                                    --query "InstanceInformationList[0].PingStatus" `
                                    --output text 2>&1

                                if ($LASTEXITCODE -eq 0 -and
                                    "$status".Trim() -eq 'Online') {
                                    $online = $true
                                    break
                                }

                                Start-Sleep -Seconds 10
                            }

                            if (-not $online) {
                                throw "Instance $instanceId did not become available in SSM."
                            }

                            $commands = @(
                                'sudo /usr/local/bin/k3s kubectl get nodes',
                                'sudo systemctl is-active k3s'
                            )

                            $payload = @{
                                InstanceIds = @($instanceId)
                                DocumentName = 'AWS-RunShellScript'
                                Parameters = @{ commands = $commands }
                                TimeoutSeconds = 120
                            }

                            $path = Join-Path $env:TEMP (
                                'pactum-check-' +
                                [guid]::NewGuid().ToString('N') + '.json'
                            )

                            try {
                                [IO.File]::WriteAllText(
                                    $path,
                                    ($payload | ConvertTo-Json -Depth 8 -Compress),
                                    [System.Text.UTF8Encoding]::new($false)
                                )

                                $commandId = & aws ssm send-command `
                                    --region $env:AWS_REGION `
                                    --cli-input-json "file://$path" `
                                    --query 'Command.CommandId' `
                                    --output text

                                if ($LASTEXITCODE -ne 0) {
                                    throw "Could not run k3s check on $instanceId."
                                }
                            }
                            finally {
                                Remove-Item $path -Force -ErrorAction SilentlyContinue
                            }

                            $complete = $false
                            for ($i = 0; $i -lt 30; $i++) {
                                Start-Sleep -Seconds 5

                                $status = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query Status --output text 2>&1

                                if ("$status".Trim() -eq 'Success') {
                                    $complete = $true
                                    break
                                }

                                if ("$status".Trim() -in @(
                                    'Failed', 'Cancelled', 'TimedOut'
                                )) {
                                    break
                                }
                            }

                            if (-not $complete) {
                                $details = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query StandardErrorContent --output text
                                throw "k3s readiness check failed on ${instanceId}: $details"
                            }

                            Write-Host "SSM and k3s ready on $instanceId"
                        }
                    '''
                }
            }
        }

        stage('Install Node Exporter') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        $instanceIds = @(
                            $env:PACTUM_INSTANCE_IDS.Split(',') |
                            ForEach-Object { $_.Trim() } |
                            Where-Object { $_ }
                        )

                        if ($instanceIds.Count -ne 2) {
                            throw "Expected two backend instances; found $($instanceIds.Count)."
                        }

                        $nodeExporterScript = @'
set -eu

VERSION="1.9.1"
ARCH="$(dpkg --print-architecture)"

case "$ARCH" in
    amd64) NODE_ARCH="amd64" ;;
    arm64) NODE_ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

if ! id node_exporter >/dev/null 2>&1; then
    sudo useradd --system --no-create-home \
        --shell /usr/sbin/nologin node_exporter
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL \
    "https://github.com/prometheus/node_exporter/releases/download/v${VERSION}/node_exporter-${VERSION}.linux-${NODE_ARCH}.tar.gz" \
    -o "$TMP_DIR/node_exporter.tar.gz"

tar -xzf "$TMP_DIR/node_exporter.tar.gz" -C "$TMP_DIR"

sudo install -o root -g root -m 0755 \
    "$TMP_DIR/node_exporter-${VERSION}.linux-${NODE_ARCH}/node_exporter" \
    /usr/local/bin/node_exporter

sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<'SERVICE'
[Unit]
Description=Prometheus Node Exporter
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9100
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
sudo systemctl restart node_exporter
sudo systemctl is-active --quiet node_exporter

curl -fsS http://127.0.0.1:9100/metrics >/dev/null
echo "Node Exporter is running on port 9100."
'@

                        $payload = @{
                            InstanceIds = $instanceIds
                            DocumentName = 'AWS-RunShellScript'
                            Comment = 'Install Prometheus Node Exporter on Pactum backend instances'
                            Parameters = @{
                                commands = @($nodeExporterScript)
                            }
                            TimeoutSeconds = 300
                        }

                        $path = Join-Path $env:TEMP (
                            'pactum-node-exporter-' +
                            [guid]::NewGuid().ToString('N') + '.json'
                        )

                        try {
                            [IO.File]::WriteAllText(
                                $path,
                                ($payload | ConvertTo-Json -Depth 8 -Compress),
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            $commandId = & aws ssm send-command `
                                --region $env:AWS_REGION `
                                --cli-input-json "file://$path" `
                                --query 'Command.CommandId' `
                                --output text

                            if ($LASTEXITCODE -ne 0) {
                                throw 'Could not submit Node Exporter installation command.'
                            }
                        }
                        finally {
                            Remove-Item $path -Force -ErrorAction SilentlyContinue
                        }

                        $commandId = "$commandId".Trim()

                        foreach ($instanceId in $instanceIds) {
                            $finished = $false

                            for ($i = 0; $i -lt 60; $i++) {
                                Start-Sleep -Seconds 5

                                $status = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query Status `
                                    --output text 2>&1

                                if ($LASTEXITCODE -ne 0) {
                                    continue
                                }

                                $status = "$status".Trim()

                                if ($status -eq 'Success') {
                                    $finished = $true
                                    break
                                }

                                if ($status -in @(
                                    'Failed', 'Cancelled', 'TimedOut'
                                )) {
                                    break
                                }
                            }

                            $stdout = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $instanceId `
                                --query StandardOutputContent `
                                --output text 2>&1

                            if ($stdout) {
                                Write-Host "$instanceId`: $stdout"
                            }

                            if (-not $finished) {
                                $stderr = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query StandardErrorContent `
                                    --output text 2>&1

                                throw "Node Exporter installation failed on ${instanceId}: $stderr"
                            }
                        }
                    '''
                }
            }
        }

        stage('Configure Monitoring') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        $instanceId = $env:PACTUM_MONITORING_INSTANCE_ID

                        if (-not $instanceId) {
                            throw 'Monitoring instance ID is missing.'
                        }

                        $ips = @(
                            $env:PACTUM_PRIVATE_IPS.Split(',') |
                            ForEach-Object { $_.Trim() } |
                            Where-Object { $_ }
                        )

                        if ($ips.Count -ne 2) {
                            throw "Expected two backend private IPs; got $($ips.Count)."
                        }

                        foreach ($ip in $ips) {
                           if ($ip -notmatch '^(?:\\d{1,3}\\.){3}\\d{1,3}$') {
                                throw "Invalid backend private IP: $ip"
                            }

                            $octets = $ip.Split('.')
                            foreach ($octet in $octets) {
                                if ([int]$octet -gt 255) {
                                    throw "Invalid backend private IP: $ip"
                                }
                            }
                        }

                        $scriptPath = Join-Path `
                            $env:WORKSPACE `
                            'infra/scripts/setup-monitoring.sh'

                        if (-not (Test-Path $scriptPath)) {
                            throw "Missing monitoring script: $scriptPath"
                        }

                        # Wait for the monitoring instance to become SSM Online.
                        $online = $false

                        for ($i = 0; $i -lt 60; $i++) {
                            $status = & aws ssm describe-instance-information `
                                --region $env:AWS_REGION `
                                --filters "Key=InstanceIds,Values=$instanceId" `
                                --query "InstanceInformationList[0].PingStatus" `
                                --output text 2>&1

                            if ($LASTEXITCODE -eq 0 -and
                                "$status".Trim() -eq 'Online') {
                                $online = $true
                                break
                            }

                            Start-Sleep -Seconds 10
                        }

                        if (-not $online) {
                            throw "Monitoring instance $instanceId is not SSM Online."
                        }

                        # Encode the script and split it into shell-safe chunks.
                        $encoded = [Convert]::ToBase64String(
                            [IO.File]::ReadAllBytes($scriptPath)
                        )

                        $chunks = @()
                        for ($offset = 0; $offset -lt $encoded.Length; $offset += 3000) {
                            $length = [Math]::Min(3000, $encoded.Length - $offset)
                            $chunks += $encoded.Substring($offset, $length)
                        }

                        $commands = @(
                            'set -e',
                            'cloud-init status --wait >/dev/null 2>&1 || true',
                            'rm -f /tmp/pactum-monitoring.b64 /tmp/pactum-setup-monitoring.sh'
                        )

                        foreach ($chunk in $chunks) {
                            $commands += "printf '%s' '$chunk' >> /tmp/pactum-monitoring.b64"
                        }

                        $commands += @(
                            'base64 -d /tmp/pactum-monitoring.b64 > /tmp/pactum-setup-monitoring.sh',
                            'chmod 700 /tmp/pactum-setup-monitoring.sh',
                            "bash /tmp/pactum-setup-monitoring.sh '$($ips[0])' '$($ips[1])'",
                            'rm -f /tmp/pactum-monitoring.b64 /tmp/pactum-setup-monitoring.sh'
                        )

                        $payload = @{
                            InstanceIds = @($instanceId)
                            DocumentName = 'AWS-RunShellScript'
                            Comment = 'Install and configure Pactum monitoring'
                            Parameters = @{
                                commands = $commands
                            }
                            TimeoutSeconds = 900
                        }

                        $inputPath = Join-Path $env:TEMP (
                            'pactum-monitor-' +
                            [guid]::NewGuid().ToString('N') + '.json'
                        )

                        try {
                            [IO.File]::WriteAllText(
                                $inputPath,
                                ($payload | ConvertTo-Json -Depth 8 -Compress),
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            $commandId = & aws ssm send-command `
                                --region $env:AWS_REGION `
                                --cli-input-json "file://$inputPath" `
                                --query 'Command.CommandId' `
                                --output text

                            if ($LASTEXITCODE -ne 0) {
                                throw 'Failed to submit monitoring setup through SSM.'
                            }
                        }
                        finally {
                            Remove-Item $inputPath -Force -ErrorAction SilentlyContinue
                        }

                        $commandId = "$commandId".Trim()
                        $finished = $false

                        for ($i = 0; $i -lt 180; $i++) {
                            Start-Sleep -Seconds 5

                            $status = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $instanceId `
                                --query Status `
                                --output text 2>&1

                            if ($LASTEXITCODE -ne 0) {
                                continue
                            }

                            $status = "$status".Trim()

                            if ($status -eq 'Success') {
                                $finished = $true
                                break
                            }

                            if ($status -in @('Failed', 'Cancelled', 'TimedOut')) {
                                break
                            }
                        }

                        $previousErrorActionPreference = $ErrorActionPreference
                        $ErrorActionPreference = 'Continue'

                        try {
                            $stdout = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $instanceId `
                                --query StandardOutputContent `
                                --output text 2>&1

                            $stdoutExitCode = $LASTEXITCODE
                        }
                        finally {
                            $ErrorActionPreference = $previousErrorActionPreference
                        }

                        if ($stdoutExitCode -ne 0) {
                            throw "Could not retrieve monitoring setup stdout: $stdout"
                        }

                        if ($stdout) {
                            Write-Host $stdout
                        }

                        if (-not $finished) {
                            $previousErrorActionPreference = $ErrorActionPreference
                            $ErrorActionPreference = 'Continue'

                            try {
                                $stderr = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query StandardErrorContent `
                                    --output text 2>&1

                                $stderrExitCode = $LASTEXITCODE
                            }
                            finally {
                                $ErrorActionPreference = $previousErrorActionPreference
                            }

                            if ($stderrExitCode -ne 0) {
                                throw "Monitoring setup failed, and SSM stderr retrieval also failed: $stderr"
                            }

                            throw "Monitoring setup failed. SSM stderr: $stderr"
                        }

                        Write-Host 'Monitoring setup completed successfully.'
                    '''
                }
            }
        }


        stage('Verify Monitoring Services') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        $instanceId = $env:PACTUM_MONITORING_INSTANCE_ID

                        if (-not $instanceId) {
                            throw 'PACTUM_MONITORING_INSTANCE_ID is missing.'
                        }

                        $online = $false

                        for ($i = 0; $i -lt 60; $i++) {
                            $status = & aws ssm describe-instance-information `
                                --region $env:AWS_REGION `
                                --filters "Key=InstanceIds,Values=$instanceId" `
                                --query "InstanceInformationList[0].PingStatus" `
                                --output text 2>&1

                            if ($LASTEXITCODE -eq 0 -and
                                "$status".Trim() -eq 'Online') {
                                $online = $true
                                break
                            }

                            Start-Sleep -Seconds 10
                        }

                        if (-not $online) {
                            throw "Monitoring instance $instanceId did not become available in SSM."
                        }

                        $remoteCommand = @'
set -eu

echo "Checking Docker service..."
sudo systemctl is-active --quiet docker

echo "Checking Prometheus container..."
sudo docker inspect -f '{{.State.Running}}' prometheus | grep -qx true

echo "Checking Grafana container..."
sudo docker inspect -f '{{.State.Running}}' grafana | grep -qx true

echo "Checking Prometheus readiness..."
curl -fsS http://127.0.0.1:9090/-/ready >/dev/null

echo "Checking Grafana health..."
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

echo MONITORING_READY
'@

                        $payload = @{
                            InstanceIds = @($instanceId)
                            DocumentName = 'AWS-RunShellScript'
                            Comment = 'Verify Pactum Prometheus and Grafana'
                            Parameters = @{
                                commands = @($remoteCommand)
                            }
                            TimeoutSeconds = 900
                        }

                        $path = Join-Path $env:TEMP (
                            'pactum-monitor-check-' +
                            [guid]::NewGuid().ToString('N') + '.json'
                        )

                        try {
                            [IO.File]::WriteAllText(
                                $path,
                                ($payload | ConvertTo-Json -Depth 8 -Compress),
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            $commandId = & aws ssm send-command `
                                --region $env:AWS_REGION `
                                --cli-input-json "file://$path" `
                                --query 'Command.CommandId' `
                                --output text

                            if ($LASTEXITCODE -ne 0) {
                                throw 'Could not submit monitoring verification command.'
                            }
                        }
                        finally {
                            Remove-Item $path -Force -ErrorAction SilentlyContinue
                        }

                        $commandId = "$commandId".Trim()
                        $finished = $false

                        for ($i = 0; $i -lt 180; $i++) {
                            Start-Sleep -Seconds 5

                            $previousPreference = $ErrorActionPreference

                            try {
                                $ErrorActionPreference = 'Continue'

                                $status = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query Status `
                                    --output text 2>&1

                                $awsExitCode = $LASTEXITCODE
                            }
                            finally {
                                $ErrorActionPreference = $previousPreference
                            }

                            if ($awsExitCode -ne 0) {
                                Write-Host "AWS CLI status query failed; retrying: $status"
                                continue
                            }

                            $status = "$status".Trim()

                            if ($status -eq 'Success') {
                                $finished = $true
                                break
                            }

                            if ($status -in @('Failed', 'Cancelled', 'TimedOut', 'Cancelling')) {
                                break
                            }
                        }

                        $previousPreference = $ErrorActionPreference

                        try {
                            $ErrorActionPreference = 'Continue'

                            $stdout = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $instanceId `
                                --query StandardOutputContent `
                                --output text 2>&1

                            $awsExitCode = $LASTEXITCODE
                        }
                        finally {
                            $ErrorActionPreference = $previousPreference
                        }

                        if ($awsExitCode -ne 0) {
                            throw "Could not retrieve monitoring verification stdout: $stdout"
                        }

                        if ($stdout) {
                            Write-Host $stdout
                        }

                        if ($stdout) {
                            Write-Host $stdout
                        }

                        if (-not $finished -or "$stdout" -notmatch 'MONITORING_READY') {
                            $previousPreference = $ErrorActionPreference

                            try {
                                $ErrorActionPreference = 'Continue'

                                $stderr = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query StandardErrorContent `
                                    --output text 2>&1

                                $awsExitCode = $LASTEXITCODE
                            }
                            finally {
                                $ErrorActionPreference = $previousPreference
                            }

                            if ($awsExitCode -ne 0) {
                                throw "Monitoring verification failed; AWS CLI could not retrieve stderr: $stderr"
                            }

                            throw "Monitoring services did not become ready. SSM stderr: $stderr"
                        }

                        Write-Host 'Prometheus and Grafana are running.'
                    '''
                }
            }
        }


        stage('Deploy Django Backend') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    ),
                    usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKERHUB_USER',
                        passwordVariable: 'DOCKERHUB_PASS'
                    ),
                    string(
                        credentialsId: 'pactum-db-password',
                        variable: 'SUPABASE_DB_PASSWORD'
                    ),
                    string(
                        credentialsId: 'pactum-django-secret-key',
                        variable: 'DJANGO_SECRET_KEY'
                    ),
                    string(
                        credentialsId: 'pactum-email-host-user',
                        variable: 'SMTP_USER_CREDENTIAL'
                    ),
                    string(
                        credentialsId: 'pactum-email-host-password',
                        variable: 'SMTP_PASSWORD_CREDENTIAL'
                    ),
                    string(
                        credentialsId: 'github-pactum-token',
                        variable: 'GITHUB_TOKEN'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        foreach ($name in @(
                            'SUPABASE_DB_PASSWORD',
                            'DJANGO_SECRET_KEY',
                            'SMTP_USER_CREDENTIAL',
                            'SMTP_PASSWORD_CREDENTIAL',
                            'GITHUB_TOKEN'
                        )) {
                            if (-not [Environment]::GetEnvironmentVariable($name)) {
                                throw "Required credential is empty: $name"
                            }
                        }

                        $dbB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes($env:SUPABASE_DB_PASSWORD)
                        )
                        $djangoB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes($env:DJANGO_SECRET_KEY)
                        )
                        $smtpUserB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes($env:SMTP_USER_CREDENTIAL.Trim())
                        )
                        $smtpPasswordB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes($env:SMTP_PASSWORD_CREDENTIAL)
                        )
                        $githubTokenB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes($env:GITHUB_TOKEN.Trim())
                        )

                        $image = '{0}/pactum-backend:{1}' -f `
                            $env:DOCKERHUB_USER.Trim(), $env:IMAGE_TAG

                        $remoteScript = @'
set -eu
export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get install -y git
sudo mkdir -p /opt/pactum-deploy
sudo chown ubuntu:ubuntu /opt/pactum-deploy
cd /opt/pactum-deploy

GITHUB_TOKEN_B64='__GITHUB_TOKEN_B64__'
GITHUB_TOKEN="$(printf '%s' "$GITHUB_TOKEN_B64" | base64 -d)"
AUTH_HEADER="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
export GIT_TERMINAL_PROMPT=0

if [ ! -d repo/.git ]; then
    git -c http.extraheader="$AUTH_HEADER" clone '__REPO__' repo
fi

cd repo
git -c http.extraheader="$AUTH_HEADER" fetch origin
git reset --hard
git clean -fd
git checkout --force --detach '__COMMIT__'
git reset --hard '__COMMIT__'
git clean -fd

unset GITHUB_TOKEN GITHUB_TOKEN_B64 AUTH_HEADER

IMAGE='__IMAGE__'
ALB_DNS='__ALB_DNS__'
INSTANCE_PRIVATE_IPS='__INSTANCE_PRIVATE_IPS__'
RUN_MIGRATIONS='__RUN_MIGRATIONS__'
DB_PASSWORD_B64='__DB_B64__'
DJANGO_SECRET_KEY_B64='__DJANGO_B64__'
SMTP_USER_B64='__SMTP_USER_B64__'
SMTP_PASSWORD_B64='__SMTP_PASSWORD_B64__'

DB_PASSWORD="$(printf '%s' "$DB_PASSWORD_B64" | base64 -d)"
DJANGO_SECRET_KEY="$(printf '%s' "$DJANGO_SECRET_KEY_B64" | base64 -d)"
SMTP_USER="$(printf '%s' "$SMTP_USER_B64" | base64 -d)"
SMTP_PASSWORD="$(printf '%s' "$SMTP_PASSWORD_B64" | base64 -d)"

sudo /usr/local/bin/k3s kubectl create namespace pactum \
    --dry-run=client -o yaml |
    sudo /usr/local/bin/k3s kubectl apply -f -

sudo /usr/local/bin/k3s kubectl -n pactum create secret generic pactum-app-secrets \
    --from-literal=DB_PASSWORD="$DB_PASSWORD" \
    --from-literal=DJANGO_SECRET_KEY="$DJANGO_SECRET_KEY" \
    --dry-run=client -o yaml |
    sudo /usr/local/bin/k3s kubectl apply -f -

sudo /usr/local/bin/k3s kubectl -n pactum create secret generic pactum-smtp-secrets \
    --from-literal=EMAIL_HOST_USER="$SMTP_USER" \
    --from-literal=EMAIL_HOST_PASSWORD="$SMTP_PASSWORD" \
    --dry-run=client -o yaml |
    sudo /usr/local/bin/k3s kubectl apply -f -

unset DB_PASSWORD DB_PASSWORD_B64
unset DJANGO_SECRET_KEY DJANGO_SECRET_KEY_B64
unset SMTP_PASSWORD SMTP_PASSWORD_B64

grep -q 'BACKEND_IMAGE_PLACEHOLDER' deploy/kubernetes/backend-deployment.yaml
grep -q 'BACKEND_IMAGE_PLACEHOLDER' deploy/kubernetes/django-migration-job.yaml

sed -i "s|BACKEND_IMAGE_PLACEHOLDER|$IMAGE|g" \
    deploy/kubernetes/backend-deployment.yaml \
    deploy/kubernetes/django-migration-job.yaml

ALLOWED_HOSTS="$ALB_DNS,$INSTANCE_PRIVATE_IPS,localhost,127.0.0.1"
grep -q 'ALLOWED_HOSTS_PLACEHOLDER' deploy/kubernetes/backend-deployment.yaml
sed -i "s|ALLOWED_HOSTS_PLACEHOLDER|$ALLOWED_HOSTS|g" \
    deploy/kubernetes/backend-deployment.yaml

sudo /usr/local/bin/k3s kubectl apply -n pactum \
    -f deploy/kubernetes/backend-service.yaml

if [ "$RUN_MIGRATIONS" = "true" ]; then
    sudo /usr/local/bin/k3s kubectl -n pactum delete job \
        pactum-migrate --ignore-not-found=true

    sudo /usr/local/bin/k3s kubectl apply -n pactum \
        -f deploy/kubernetes/django-migration-job.yaml

    if ! sudo /usr/local/bin/k3s kubectl wait \
        --namespace pactum \
        --for=condition=complete \
        job/pactum-migrate --timeout=600s; then

        sudo /usr/local/bin/k3s kubectl describe job/pactum-migrate -n pactum || true
        sudo /usr/local/bin/k3s kubectl get pods -n pactum -o wide || true
        sudo /usr/local/bin/k3s kubectl logs -n pactum job/pactum-migrate \
            --all-containers=true || true
        sudo /usr/local/bin/k3s kubectl get events -n pactum \
            --sort-by=.metadata.creationTimestamp || true
        exit 1
    fi
fi

sudo /usr/local/bin/k3s kubectl apply -n pactum \
    -f deploy/kubernetes/backend-deployment.yaml

sudo /usr/local/bin/k3s kubectl set env deployment/pactum-backend \
    -n pactum --from=secret/pactum-smtp-secrets

sudo /usr/local/bin/k3s kubectl set env deployment/pactum-backend \
    -n pactum \
    EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend \
    EMAIL_HOST=smtp.gmail.com \
    EMAIL_PORT=587 \
    EMAIL_USE_TLS=True \
    EMAIL_TIMEOUT=20 \
    "DEFAULT_FROM_EMAIL=$SMTP_USER" \
    DJANGO_DEBUG=False

unset SMTP_USER SMTP_USER_B64

sudo /usr/local/bin/k3s kubectl rollout restart \
    deployment/pactum-backend -n pactum

if ! sudo /usr/local/bin/k3s kubectl -n pactum rollout status \
    deployment/pactum-backend --timeout=300s; then

    sudo /usr/local/bin/k3s kubectl describe deployment/pactum-backend -n pactum || true
    sudo /usr/local/bin/k3s kubectl get pods -n pactum -o wide || true
    sudo /usr/local/bin/k3s kubectl logs -n pactum -l app=pactum-backend \
        --all-containers=true --prefix=true --tail=100 || true
    sudo /usr/local/bin/k3s kubectl get events -n pactum \
        --sort-by=.metadata.creationTimestamp || true
    exit 1
fi

sudo /usr/local/bin/k3s kubectl -n pactum get pods -o wide
sudo /usr/local/bin/k3s kubectl -n pactum get service

echo "Remote deployment completed"
'@

                        $remoteScript = $remoteScript.Replace(
                            '__REPO__', $env:GITHUB_REPO
                        ).Replace(
                            '__COMMIT__', $env:GIT_COMMIT_FULL
                        ).Replace(
                            '__IMAGE__', $image
                        ).Replace(
                            '__DB_B64__', $dbB64
                        ).Replace(
                            '__DJANGO_B64__', $djangoB64
                        ).Replace(
                            '__SMTP_USER_B64__', $smtpUserB64
                        ).Replace(
                            '__SMTP_PASSWORD_B64__', $smtpPasswordB64
                        ).Replace(
                            '__GITHUB_TOKEN_B64__', $githubTokenB64
                        ).Replace(
                            '__ALB_DNS__', $env:PACTUM_ALB_DNS
                        ).Replace(
                            '__INSTANCE_PRIVATE_IPS__', $env:PACTUM_PRIVATE_IPS
                        )

                        $instanceIds = @(
                            $env:PACTUM_INSTANCE_IDS.Split(',') |
                            ForEach-Object { $_.Trim() } |
                            Where-Object { $_ }
                        )

                        if ($instanceIds.Count -ne 2) {
                            throw "Expected 2 EC2 instances, received $($instanceIds.Count)."
                        }

                        for ($index = 0; $index -lt $instanceIds.Count; $index++) {
                            $instanceId = $instanceIds[$index]

                            # Shared Supabase database: run migrations only once.
                            $runMigrations = if ($index -eq 0) { 'true' } else { 'false' }

                            $scriptForInstance = $remoteScript.Replace(
                                '__RUN_MIGRATIONS__', $runMigrations
                            )

                            Write-Host "Deploying to $instanceId (migrations: $runMigrations)"

                            $payload = @{
                                InstanceIds = @($instanceId)
                                DocumentName = 'AWS-RunShellScript'
                                Comment = "Deploy Pactum backend $env:IMAGE_TAG"
                                Parameters = @{
                                    commands = @($scriptForInstance)
                                }
                                TimeoutSeconds = 900
                            }

                            $inputPath = Join-Path $env:TEMP (
                                'pactum-deploy-' + [guid]::NewGuid().ToString('N') + '.json'
                            )

                            try {
                                [IO.File]::WriteAllText(
                                    $inputPath,
                                    ($payload | ConvertTo-Json -Depth 8 -Compress),
                                    [System.Text.UTF8Encoding]::new($false)
                                )

                                $commandId = & aws ssm send-command `
                                    --region $env:AWS_REGION `
                                    --cli-input-json "file://$inputPath" `
                                    --query 'Command.CommandId' `
                                    --output text

                                if ($LASTEXITCODE -ne 0) {
                                    throw "SSM command submission failed for $instanceId."
                                }
                            }
                            finally {
                                Remove-Item $inputPath -Force -ErrorAction SilentlyContinue
                            }

                            $commandId = "$commandId".Trim()
                            $finished = $false

                            for ($attempt = 0; $attempt -lt 180; $attempt++) {
                                Start-Sleep -Seconds 5

                                $status = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query Status `
                                    --output text 2>&1

                                if ($LASTEXITCODE -ne 0) {
                                    continue
                                }

                                $status = "$status".Trim()

                                if ($status -eq 'Success') {
                                    $finished = $true
                                    break
                                }

                                if ($status -in @(
                                    'Failed',
                                    'Cancelled',
                                    'TimedOut',
                                    'Cancelling'
                                )) {
                                    break
                                }
                            }

                            $stdout = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $instanceId `
                                --query StandardOutputContent `
                                --output text 2>&1

                            if ($stdout) {
                                Write-Host $stdout
                            }

                            if (-not $finished) {
                                $stderr = & aws ssm get-command-invocation `
                                    --region $env:AWS_REGION `
                                    --command-id $commandId `
                                    --instance-id $instanceId `
                                    --query StandardErrorContent `
                                    --output text 2>&1

                                throw "Deployment failed on ${instanceId}: $stderr"
                            }

                            Write-Host "Deployment succeeded on $instanceId"
                        }

                        Write-Host "Both EC2 instances deployed successfully."
                        Write-Host "Backend: http://$env:PACTUM_ALB_DNS"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pactum backend deployment completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Inspect the first failed stage and SSM output.'
        }
        always {
            echo 'Pipeline finished.'
        }
    }
}
