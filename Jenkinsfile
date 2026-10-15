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

        // Use a new stack name while testing; do not replace your old stack.
        STACK_NAME = 'pactum-backend'

        DB_NAME = 'pactum'
        DB_USERNAME = 'pactumadmin'
        DB_INSTANCE_CLASS = 'db.t3.micro'
        INSTANCE_TYPE = 't3.medium'

        K8S_NAMESPACE = 'pactum'

        // CHANGE THIS to the exact origin of your Vercel deployment.
        VERCEL_ORIGIN = 'https://pactum-sable.vercel.app'
    }

    stages {
        stage('Checkout and Validate') {
            steps {
                checkout scm

                script {
                    env.IMAGE_TAG = powershell(
                        returnStdout: true,
                        script: 'git rev-parse --short=12 HEAD'
                    ).trim()

                    if (!env.IMAGE_TAG) {
                        error('Could not determine the Git commit SHA.')
                    }

                    echo "Backend image tag: ${env.IMAGE_TAG}"
                }

                powershell '''
                    $ErrorActionPreference = 'Stop'

                    foreach ($tool in @('aws', 'docker')) {
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

                    if ($env:VERCEL_ORIGIN -match 'REPLACE-WITH') {
                        throw 'Set VERCEL_ORIGIN in the Jenkinsfile to your real Vercel origin.'
                    }

                    if ($env:VERCEL_ORIGIN -notmatch '^https://[A-Za-z0-9.-]+$') {
                        throw 'VERCEL_ORIGIN must be an HTTPS origin without a path.'
                    }

                    docker info
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
                        $user = $env:DOCKERHUB_USER.Trim()
                        $pass = $env:DOCKERHUB_PASS.Trim()

                        $tmp = Join-Path $env:TEMP ('dh-' + [guid]::NewGuid().ToString('N'))

                        try {
                            [IO.File]::WriteAllText(
                                $tmp,
                                $pass,
                                (New-Object Text.UTF8Encoding($false))
                            )

                            cmd /c "docker login -u $user --password-stdin < `"$tmp`" 2>&1"
                            $loginExit = $LASTEXITCODE
                        }
                        finally {
                            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
                        }

                        if ($loginExit -ne 0) {
                            throw 'Docker Hub login failed.'
                        }

                        try {
                            docker build -t $image backend
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend Docker build failed.'
                            }

                            docker push $image
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend Docker push failed.'
                            }
                        }
                        finally {
                            docker logout
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
                    ),
                    string(
                        credentialsId: 'pactum-django-secret-key',
                        variable: 'DJANGO_SECRET_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        aws sts get-caller-identity
                        if ($LASTEXITCODE -ne 0) {
                            throw 'AWS credentials are invalid.'
                        }

                        aws cloudformation deploy `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --template-file infra/cloudformation/pactum-backend.yaml `
                            --capabilities CAPABILITY_NAMED_IAM `
                            --parameter-overrides `
                                "DbName=$env:DB_NAME" `
                                "DbUsername=$env:DB_USERNAME" `
                                "DbInstanceClass=$env:DB_INSTANCE_CLASS" `
                                "InstanceType=$env:INSTANCE_TYPE" `
                                "DjangoSecretKey=$env:DJANGO_SECRET_KEY" `
                            --no-fail-on-empty-changeset

                        if ($LASTEXITCODE -ne 0) {
                            throw 'CloudFormation deployment failed.'
                        }

                        $rawOutputs = aws cloudformation describe-stacks `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --query "Stacks[0].Outputs" `
                            --output json

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not retrieve CloudFormation outputs.'
                        }

                        $outputs = @{}
                        foreach ($item in ($rawOutputs | ConvertFrom-Json)) {
                            $outputs[$item.OutputKey] = $item.OutputValue
                        }

                        if (-not $outputs.InstanceId -or -not $outputs.LoadBalancerDNS) {
                            throw 'Required CloudFormation outputs are missing.'
                        }

                        $env:PACTUM_INSTANCE_ID = $outputs.InstanceId
                        $env:PACTUM_ALB_DNS = $outputs.LoadBalancerDNS

                        Write-Host "EC2 instance: $env:PACTUM_INSTANCE_ID"
                        Write-Host "ALB DNS: $env:PACTUM_ALB_DNS"
                    '''
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
                            $status = aws ssm describe-instance-information `
                                --region $env:AWS_REGION `
                                --filters "Key=InstanceIds,Values=$env:PACTUM_INSTANCE_ID" `
                                --query "InstanceInformationList[0].PingStatus" `
                                --output text 2>$null

                            if ($LASTEXITCODE -eq 0 -and $status.Trim() -eq 'Online') {
                                $online = $true
                                break
                            }

                            Start-Sleep -Seconds 10
                        }

                        if (-not $online) {
                            throw 'EC2 did not register as an online SSM managed instance within 10 minutes.'
                        }

                        $commands = @(
                            'sudo /usr/local/bin/kubectl get nodes',
                            'sudo systemctl is-active k3s'
                        )

                        $inputObject = @{
                            InstanceIds = @($env:PACTUM_INSTANCE_ID)
                            DocumentName = 'AWS-RunShellScript'
                            Comment = 'Verify Pactum k3s installation'
                            Parameters = @{
                                commands = $commands
                            }
                            TimeoutSeconds = 120
                        }

                        $inputPath = Join-Path $env:TEMP 'pactum-ssm-check.json'
                        $inputObject |
                            ConvertTo-Json -Depth 8 |
                            Set-Content -Path $inputPath -Encoding ascii

                        $commandId = aws ssm send-command `
                            --region $env:AWS_REGION `
                            --cli-input-json "file://$inputPath" `
                            --query "Command.CommandId" `
                            --output text

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not send the k3s verification command.'
                        }

                        $commandId = $commandId.Trim()
                        $complete = $false

                        for ($i = 0; $i -lt 30; $i++) {
                            Start-Sleep -Seconds 5

                            $status = aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
                                --query Status `
                                --output text 2>$null

                            if ($LASTEXITCODE -ne 0) {
                                continue
                            }

                            $status = $status.Trim()

                            if ($status -eq 'Success') {
                                $complete = $true
                                break
                            }

                            if ($status -in @('Failed', 'Cancelled', 'TimedOut')) {
                                break
                            }
                        }

                        if (-not $complete) {
                            $details = aws ssm get-command-invocation `
                                --region $env:AWS_REGION `
                                --command-id $commandId `
                                --instance-id $env:PACTUM_INSTANCE_ID `
                                --query StandardErrorContent `
                                --output text 2>$null

                            throw "k3s verification failed: $details"
                        }
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
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        $image = '{0}/pactum-backend:{1}' -f `
                            (git config --get user.name), $env:IMAGE_TAG

                        # Use the actual Docker Hub username from the credential
                        # rather than Git configuration.
                        $dockerCred = Get-Content Env:DOCKERHUB_USER -ErrorAction SilentlyContinue
                        if (-not $dockerCred) {
                            throw 'Docker Hub username is unavailable for the deployment image.'
                        }
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Pactum backend pipeline finished. Review the stage logs for the first failure.'
        }
    }
}