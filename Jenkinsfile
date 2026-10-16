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

                    env.IMAGE_TAG = env.GIT_COMMIT_FULL.take(12)

                    if (!env.IMAGE_TAG || !env.GIT_COMMIT_FULL) {
                        error('Could not determine the Git commit SHA.')
                    }

                    echo "Backend image tag: ${env.IMAGE_TAG}"
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
                        'deploy/kubernetes/django-migration-job.yaml'
                    )) {
                        if (-not (Test-Path $path)) {
                            throw "Missing required file: $path"
                        }
                    }

                    if ($env:VERCEL_ORIGIN -notmatch '^https://[A-Za-z0-9.-]+$') {
                        throw 'VERCEL_ORIGIN must be an HTTPS origin without a path.'
                    }

                    docker info 2>&1 | Out-Null
                    if ($LASTEXITCODE -ne 0) {
                        throw 'Docker is unavailable. Start Docker Desktop in Linux-container mode.'
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
                            'dh-' + [guid]::NewGuid().ToString('N')
                        )

                        try {
                            [IO.File]::WriteAllText(
                                $tmp,
                                $pass,
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            cmd /c "docker login -u $user --password-stdin < `"$tmp`" 2>&1"
                            $loginExit = $LASTEXITCODE

                            if ($loginExit -ne 0) {
                                throw 'Docker Hub login failed.'
                            }

                            $image = '{0}/pactum-backend:{1}' -f $user, $env:IMAGE_TAG

                            docker build -t $image backend
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend Docker build failed.'
                            }

                            docker push $image
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend Docker push failed.'
                            }

                            Write-Host "Published image: $image"
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

                                $identity = & aws sts get-caller-identity `
                                    --region $env:AWS_REGION 2>&1
                                if ($LASTEXITCODE -ne 0) {
                                    throw "AWS credentials failed: $identity"
                                }

                                $deployOutput = & aws cloudformation deploy `
                                    --region $env:AWS_REGION `
                                    --stack-name $env:STACK_NAME `
                                    --template-file infra/cloudformation/pactum-backend.yaml `
                                    --capabilities CAPABILITY_NAMED_IAM `
                                    --parameter-overrides "InstanceType=$env:INSTANCE_TYPE" `
                                    --no-fail-on-empty-changeset 2>&1

                                if ($LASTEXITCODE -ne 0) {
                                    throw "CloudFormation deployment failed: $deployOutput"
                                }

                                $raw = & aws cloudformation describe-stacks `
                                    --region $env:AWS_REGION `
                                    --stack-name $env:STACK_NAME `
                                    --query "Stacks[0].Outputs" `
                                    --output json 2>&1

                                if ($LASTEXITCODE -ne 0) {
                                    throw "Could not retrieve CloudFormation outputs: $raw"
                                }

                                $outputs = @{}
                                foreach ($item in ($raw | ConvertFrom-Json)) {
                                    $outputs[$item.OutputKey] = $item.OutputValue
                                }

                                if (-not $outputs.InstanceId -or
                                    -not $outputs.LoadBalancerDNS -or
                                    -not $outputs.InstancePrivateIp) {
                                    throw 'Required outputs InstanceId, LoadBalancerDNS, or InstancePrivateIp are missing.'
                                }

                                Write-Output "INSTANCE_ID=$($outputs.InstanceId)"
                                Write-Output "ALB_DNS=$($outputs.LoadBalancerDNS)"
                                Write-Output "INSTANCE_PRIVATE_IP=$($outputs.InstancePrivateIp)"
                            '''
                        ).trim()

                        def instanceLine = result.readLines().find {
                            it.startsWith('INSTANCE_ID=')
                        }
                        def albLine = result.readLines().find {
                            it.startsWith('ALB_DNS=')
                        }

                        def privateIpLine = result.readLines().find {
                            it.startsWith('INSTANCE_PRIVATE_IP=')
                        }

                        if (!instanceLine || !albLine || !privateIpLine) {
                            error("Could not parse CloudFormation outputs. Output: ${result}")
                        }

                        env.PACTUM_INSTANCE_ID = instanceLine.substring('INSTANCE_ID='.length())
                        env.PACTUM_ALB_DNS = albLine.substring('ALB_DNS='.length())
                        env.PACTUM_PRIVATE_IP = privateIpLine.substring('INSTANCE_PRIVATE_IP='.length())

                        echo "EC2 instance: ${env.PACTUM_INSTANCE_ID}"
                        echo "Load balancer: http://${env.PACTUM_ALB_DNS}"
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
                        $online = $false

                        for ($i = 0; $i -lt 60; $i++) {
                            $status = & aws ssm describe-instance-information `
                                --region $env:AWS_REGION `
                                --filters "Key=InstanceIds,Values=$env:PACTUM_INSTANCE_ID" `
                                --query "InstanceInformationList[0].PingStatus" `
                                --output text 2>&1

                            if ($LASTEXITCODE -eq 0 -and "$status".Trim() -eq 'Online') {
                                $online = $true
                                break
                            }

                            Start-Sleep -Seconds 10
                        }

                        if (-not $online) {
                            throw 'EC2 did not become an online SSM managed instance within 10 minutes.'
                        }

                        $commands = @(
                            'sudo /usr/local/bin/k3s kubectl get nodes',
                            'sudo systemctl is-active k3s'
                        )

                        $inputObject = @{
                            InstanceIds = @($env:PACTUM_INSTANCE_ID)
                            DocumentName = 'AWS-RunShellScript'
                            Comment = 'Verify Pactum k3s installation'
                            Parameters = @{ commands = $commands }
                            TimeoutSeconds = 120
                        }

                        $inputPath = Join-Path $env:TEMP (
                            'pactum-ssm-check-' + [guid]::NewGuid().ToString('N') + '.json'
                        )

                        try {
                            $inputObject |
                                ConvertTo-Json -Depth 8 |
                                Set-Content -Path $inputPath -Encoding ascii

                            $commandId = & aws ssm send-command `
                                --region $env:AWS_REGION `
                                --cli-input-json "file://$inputPath" `
                                --query 'Command.CommandId' `
                                --output text 2>&1

                            if ($LASTEXITCODE -ne 0) {
                                throw "Could not send k3s verification command: $commandId"
                            }
                        }
                        finally {
                            Remove-Item $inputPath -Force -ErrorAction SilentlyContinue
                        }

                        $commandId = "$commandId".Trim()
                        $complete = $false

                        for ($i = 0; $i -lt 30; $i++) {
                            Start-Sleep -Seconds 5

                            $status = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
                                --query Status `
                                --output text 2>&1

                            if ($LASTEXITCODE -ne 0) {
                                continue
                            }

                            $status = "$status".Trim()

                            if ($status -eq 'Success') {
                                $complete = $true
                                break
                            }

                            if ($status -in @('Failed', 'Cancelled', 'TimedOut')) {
                                break
                            }
                        }

                        if (-not $complete) {
                            $details = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
                                --query StandardErrorContent `
                                --output text 2>&1

                            throw "k3s verification failed: $details"
                        }

                        Write-Host 'SSM and k3s are ready.'
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
                        credentialsId: 'github-pactum-token',
                        variable: 'GITHUB_TOKEN'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        if (-not $env:SUPABASE_DB_PASSWORD -or
                            -not $env:DJANGO_SECRET_KEY -or
                            -not $env:GITHUB_TOKEN) {
                            throw 'Database password, Django secret key, or GitHub token is empty.'
                        }

                        if (-not $env:PACTUM_INSTANCE_ID) {
                            throw 'PACTUM_INSTANCE_ID is missing.'
                        }

                        $dbB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes(
                                $env:SUPABASE_DB_PASSWORD
                            )
                        )

                        $djangoB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes(
                                $env:DJANGO_SECRET_KEY
                            )
                        )

                        # Base64 is transport encoding, not encryption.
                        # Never print the encoded token or remote script.
                        $githubTokenB64 = [Convert]::ToBase64String(
                            [Text.Encoding]::UTF8.GetBytes(
                                $env:GITHUB_TOKEN.Trim()
                            )
                        )

                        $image = '{0}/pactum-backend:{1}' -f `
                            $env:DOCKERHUB_USER.Trim(), $env:IMAGE_TAG

                        $commit = $env:GIT_COMMIT_FULL
                        $repo = $env:GITHUB_REPO

                        $remoteScript = @'
set -eu
export DEBIAN_FRONTEND=noninteractive

echo "Preparing deployment directory"
sudo apt-get update
sudo apt-get install -y git
sudo mkdir -p /opt/pactum-deploy
sudo chown ubuntu:ubuntu /opt/pactum-deploy
cd /opt/pactum-deploy

GITHUB_TOKEN_B64='__GITHUB_TOKEN_B64__'
GITHUB_TOKEN="$(printf '%s' "$GITHUB_TOKEN_B64" | base64 -d)"
AUTH_HEADER="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
export GIT_TERMINAL_PROMPT=0

# Clone only when the deployment checkout does not exist.
if [ ! -d repo/.git ]; then
    git -c http.extraheader="$AUTH_HEADER" clone '__REPO__' repo
fi

cd repo

# Fetch Git updates before selecting the exact commit built by Jenkins.
git -c http.extraheader="$AUTH_HEADER" fetch origin

# This directory is a disposable deployment checkout.
# Remove changes left by previous sed replacements or manual edits.
# Do this BEFORE checkout so Git cannot reject the new commit.
git reset --hard
git clean -fd

# Prefer the exact commit Jenkins built and pushed to Docker Hub.
# Do not deploy whichever branch happens to be checked out locally.
git checkout --force --detach '__COMMIT__'
git reset --hard '__COMMIT__'
git clean -fd

echo "Deployment source commit:"
git rev-parse HEAD

unset GITHUB_TOKEN GITHUB_TOKEN_B64 AUTH_HEADER

IMAGE='__IMAGE__'
ALB_DNS='__ALB_DNS__'
INSTANCE_PRIVATE_IP='__INSTANCE_PRIVATE_IP__'
DB_PASSWORD_B64='__DB_B64__'
DJANGO_SECRET_KEY_B64='__DJANGO_B64__'

DB_PASSWORD="$(printf '%s' "$DB_PASSWORD_B64" | base64 -d)"
DJANGO_SECRET_KEY="$(printf '%s' "$DJANGO_SECRET_KEY_B64" | base64 -d)"

echo "Applying Kubernetes namespace"
sudo /usr/local/bin/k3s kubectl create namespace pactum \
    --dry-run=client -o yaml |
    sudo /usr/local/bin/k3s kubectl apply -f -

echo "Updating application secrets"
sudo /usr/local/bin/k3s kubectl -n pactum create secret generic pactum-app-secrets \
    --from-literal=DB_PASSWORD="$DB_PASSWORD" \
    --from-literal=DJANGO_SECRET_KEY="$DJANGO_SECRET_KEY" \
    --dry-run=client -o yaml |
    sudo /usr/local/bin/k3s kubectl apply -f -

unset DB_PASSWORD DB_PASSWORD_B64
unset DJANGO_SECRET_KEY DJANGO_SECRET_KEY_B64

# Modify only after restoring the clean, exact Git commit.
# These replacements are intentionally repeated on every deployment.
echo "Updating Kubernetes image placeholders"
grep -q 'BACKEND_IMAGE_PLACEHOLDER' \
    deploy/kubernetes/backend-deployment.yaml
grep -q 'BACKEND_IMAGE_PLACEHOLDER' \
    deploy/kubernetes/django-migration-job.yaml

sed -i "s|BACKEND_IMAGE_PLACEHOLDER|$IMAGE|g" \
    deploy/kubernetes/backend-deployment.yaml \
    deploy/kubernetes/django-migration-job.yaml

ALLOWED_HOSTS="$ALB_DNS,$INSTANCE_PRIVATE_IP,localhost,127.0.0.1"

sed -i "s|ALLOWED_HOSTS_PLACEHOLDER|$ALLOWED_HOSTS|g" \
    deploy/kubernetes/backend-deployment.yaml

echo "Applying backend service"
sudo /usr/local/bin/k3s kubectl apply -n pactum \
    -f deploy/kubernetes/backend-service.yaml

echo "Running database migrations"
sudo /usr/local/bin/k3s kubectl -n pactum delete job \
    pactum-migrate --ignore-not-found=true

sudo /usr/local/bin/k3s kubectl apply -n pactum \
    -f deploy/kubernetes/django-migration-job.yaml

if ! sudo /usr/local/bin/k3s kubectl wait \
    --namespace pactum \
    --for=condition=complete \
    job/pactum-migrate \
    --timeout=600s; then

    echo "Migration Job failed or timed out."

    sudo /usr/local/bin/k3s kubectl describe \
        job/pactum-migrate -n pactum || true

    sudo /usr/local/bin/k3s kubectl get pods \
        -n pactum -l app=pactum-migrate -o wide || true

    sudo /usr/local/bin/k3s kubectl logs \
        -n pactum job/pactum-migrate \
        --all-containers=true || true

    sudo /usr/local/bin/k3s kubectl get events \
        -n pactum --sort-by=.metadata.creationTimestamp || true

    exit 1
fi

echo "Deploying backend"
sudo /usr/local/bin/k3s kubectl apply -n pactum \
    -f deploy/kubernetes/backend-deployment.yaml

if ! sudo /usr/local/bin/k3s kubectl -n pactum rollout status \
    deployment/pactum-backend --timeout=300s; then

    echo "Backend rollout failed or timed out."

    sudo /usr/local/bin/k3s kubectl describe \
        deployment/pactum-backend -n pactum || true

    sudo /usr/local/bin/k3s kubectl get pods \
        -n pactum -o wide || true

    sudo /usr/local/bin/k3s kubectl logs \
        -n pactum -l app=pactum-backend \
        --all-containers=true --prefix=true --tail=100 || true

    sudo /usr/local/bin/k3s kubectl get events \
        -n pactum --sort-by=.metadata.creationTimestamp || true

    exit 1
fi

echo "Final pod status"
sudo /usr/local/bin/k3s kubectl -n pactum get pods -o wide

echo "Service status"
sudo /usr/local/bin/k3s kubectl -n pactum get service

echo "Remote deployment completed"
'@

                        # Insert controlled values into the literal remote script.
                        $remoteScript = $remoteScript.Replace(
                            '__REPO__', $repo
                        ).Replace(
                            '__COMMIT__', $commit
                        ).Replace(
                            '__IMAGE__', $image
                        ).Replace(
                            '__DB_B64__', $dbB64
                        ).Replace(
                            '__DJANGO_B64__', $djangoB64
                        ).Replace(
                            '__GITHUB_TOKEN_B64__', $githubTokenB64
                        ).Replace(
                            '__ALB_DNS__', $env:PACTUM_ALB_DNS
                        ).Replace(
                            '__INSTANCE_PRIVATE_IP__', $env:PACTUM_PRIVATE_IP
                        )

                        $inputObject = @{
                            InstanceIds = @($env:PACTUM_INSTANCE_ID)
                            DocumentName = 'AWS-RunShellScript'
                            Comment = "Deploy Pactum backend $($env:IMAGE_TAG)"
                            Parameters = @{
                                commands = @($remoteScript)
                            }
                            TimeoutSeconds = 900
                        }

                        $inputPath = Join-Path $env:TEMP (
                            'pactum-deploy-' +
                            [guid]::NewGuid().ToString('N') + '.json'
                        )

                        try {
                            $json = $inputObject |
                                ConvertTo-Json -Depth 8 -Compress

                            [System.IO.File]::WriteAllText(
                                $inputPath,
                                $json,
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            $awsOutput = & aws ssm send-command `
                                --region $env:AWS_REGION `
                                --cli-input-json "file://$inputPath" `
                                --query 'Command.CommandId' `
                                --output text 2>&1

                            $awsExitCode = $LASTEXITCODE

                            if ($awsExitCode -ne 0) {
                                $awsOutput | ForEach-Object {
                                    Write-Host "$_"
                                }
                                throw "AWS SSM send-command failed with exit code $awsExitCode"
                            }

                            $commandId = "$awsOutput".Trim()

                            if (-not $commandId -or $commandId -eq 'None') {
                                throw "AWS SSM returned no command ID. Output: $awsOutput"
                            }

                            Write-Host "SSM command submitted: $commandId"
                        }
                        finally {
                            Remove-Item $inputPath -Force `
                                -ErrorAction SilentlyContinue
                        }

                        $finished = $false

                        for ($i = 0; $i -lt 180; $i++) {
                            Start-Sleep -Seconds 5

                            $status = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
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
                            --instance-id $env:PACTUM_INSTANCE_ID `
                            --query StandardOutputContent `
                            --output text 2>&1

                        if ($stdout) {
                            Write-Host $stdout
                        }

                        if (-not $finished) {
                            $stderr = & aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
                                --query StandardErrorContent `
                                --output text 2>&1

                            throw "Remote deployment failed. SSM stderr: $stderr"
                        }

                        Write-Host "Deployment succeeded for image $image"
                        Write-Host "Backend load balancer: http://$env:PACTUM_ALB_DNS"
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
            echo 'Pactum backend pipeline failed. Inspect the first failed stage and its SSM output.'
        }
        always {
            echo 'Pipeline finished.'
        }
    }
}