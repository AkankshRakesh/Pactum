pipeline {
    agent any

    options {
        skipDefaultCheckout(true)          // we check out once, in the first stage
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        AWS_REGION               = 'ap-south-1'
        STACK_NAME               = 'pactum'
        CLUSTER_NAME             = 'pactum-eks'
        K8S_NAMESPACE            = 'pactum'
        NEXT_PUBLIC_API_BASE_URL = '/api'
        DJANGO_ALLOWED_HOSTS     = '*'

        // Jenkins exposes these as DOCKERHUB_USR / DOCKERHUB_PSW (masked in logs)
        DOCKERHUB         = credentials('docker-hub')
        DJANGO_SECRET_KEY = credentials('pactum-django-secret-key')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = powershell(
                        returnStdout: true,
                        script: 'git rev-parse --short=12 HEAD'
                    ).trim()
                    echo "Image tag: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build and Push Images') {
            steps {
                powershell '''
                    $ErrorActionPreference = 'Continue'

                    # Run docker via cmd so Windows PowerShell 5.1 does not turn its stderr into errors
                    function Docker($argLine) {
                        cmd /c "docker $argLine 2>&1"
                        if ($LASTEXITCODE -ne 0) { throw "docker $argLine failed" }
                    }

                    $user     = $env:DOCKERHUB_USR.Trim()
                    $backend  = "$user/pactum-backend:$env:IMAGE_TAG"
                    $frontend = "$user/pactum-frontend:$env:IMAGE_TAG"

                    # Login: password goes through a BOM-free temp file (piping from PS 5.1 fails)
                    $tmp = Join-Path $env:TEMP ('dh-' + [guid]::NewGuid().ToString('N'))
                    try {
                        [IO.File]::WriteAllText($tmp, $env:DOCKERHUB_PSW.Trim(), (New-Object Text.UTF8Encoding($false)))
                        Docker "login -u $user --password-stdin < `"$tmp`""
                    }
                    finally {
                        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
                    }

                    try {
                        Docker "build --target runtime -t $backend backend"
                        Docker "build -t $frontend --build-arg NEXT_PUBLIC_API_BASE_URL=$env:NEXT_PUBLIC_API_BASE_URL frontend"
                        Docker "push $backend"
                        Docker "push $frontend"
                    }
                    finally {
                        cmd /c "docker logout 2>&1" | Out-Null
                    }
                '''
            }
        }

        stage('Provision and Deploy') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'aws-creds',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    // 1) Infrastructure (idempotent: no-op if nothing changed)
                    powershell '''
                        $ErrorActionPreference = 'Continue'
                        function Check($msg) { if ($LASTEXITCODE -ne 0) { throw $msg } }

                        $account = (aws sts get-caller-identity --query Account --output text).Trim()
                        Check 'AWS credentials are invalid or missing.'

                        # Allow only this machine's current public IP to reach the EKS API
                        $ip = (Invoke-RestMethod 'https://checkip.amazonaws.com' -TimeoutSec 15).Trim()

                        $params = @(
                            "ClusterName=$env:CLUSTER_NAME",
                            'KubernetesVersion=1.33',
                            "EksPublicAccessCidrs=$ip/32",
                            'DbName=pactum',
                            'DbUsername=pactumadmin',
                            'DbInstanceClass=db.t3.micro',
                            'NodeInstanceTypes=t3.medium',
                            'DesiredNodes=2',
                            'MaxNodes=3',
                            "ContractsBucketName=pactum-contracts-${account}-$env:AWS_REGION"
                        )

                        aws cloudformation deploy `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --template-file infra/cloudformation/pactum.yaml `
                            --capabilities CAPABILITY_NAMED_IAM `
                            --no-fail-on-empty-changeset `
                            --parameter-overrides $params
                        Check 'CloudFormation deploy failed. Check the stack Events in AWS.'
                    '''

                    // 2) Application
                    powershell '''
                        $ErrorActionPreference = 'Continue'
                        function Check($msg) { if ($LASTEXITCODE -ne 0) { throw $msg } }

                        $ns       = $env:K8S_NAMESPACE
                        $user     = $env:DOCKERHUB_USR.Trim()
                        $backend  = "$user/pactum-backend:$env:IMAGE_TAG"
                        $frontend = "$user/pactum-frontend:$env:IMAGE_TAG"

                        # Stack outputs -> $o
                        $raw = aws cloudformation describe-stacks --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME --query 'Stacks[0].Outputs' --output json
                        Check 'Could not read CloudFormation outputs.'
                        $o = @{}
                        (($raw -join "`n") | ConvertFrom-Json) | ForEach-Object { $o[$_.OutputKey] = $_.OutputValue }

                        aws eks update-kubeconfig --region $env:AWS_REGION --name $env:CLUSTER_NAME
                        Check 'Could not configure kubectl for the EKS cluster.'

                        # Database credentials from Secrets Manager
                        $dbRaw = aws secretsmanager get-secret-value --region $env:AWS_REGION `
                            --secret-id $o['DbSecretArn'] --query SecretString --output text
                        Check 'Could not read database credentials.'
                        $db = $dbRaw | ConvertFrom-Json

                        # Namespace + app secret
                        kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply -f -
                        Check 'Namespace creation failed.'

                        kubectl create secret generic pactum-app-secrets -n $ns `
                            "--from-literal=DJANGO_SECRET_KEY=$env:DJANGO_SECRET_KEY" `
                            '--from-literal=DJANGO_DEBUG=False' `
                            "--from-literal=DJANGO_ALLOWED_HOSTS=$env:DJANGO_ALLOWED_HOSTS" `
                            '--from-literal=CSRF_TRUSTED_ORIGINS=' `
                            "--from-literal=DB_NAME=$($o['DbName'])" `
                            "--from-literal=DB_USER=$($db.username)" `
                            "--from-literal=DB_PASSWORD=$($db.password)" `
                            "--from-literal=DB_HOST=$($o['DbEndpoint'])" `
                            "--from-literal=DB_PORT=$($o['DbPort'])" `
                            '--from-literal=DB_SSLMODE=require' `
                            --dry-run=client -o yaml | kubectl apply -f -
                        Check 'Could not apply the application secret.'

                        # Fill placeholders in a manifest and apply it
                        function Apply($file) {
                            $c = Get-Content "deploy/kubernetes/$file" -Raw
                            $c = $c.Replace('BACKEND_IMAGE_PLACEHOLDER', $backend)
                            $c = $c.Replace('FRONTEND_IMAGE_PLACEHOLDER', $frontend)
                            $c = $c.Replace('AWS_REGION_PLACEHOLDER', $env:AWS_REGION)
                            $c = $c.Replace('S3_BUCKET_PLACEHOLDER', $o['ContractsBucketName'])
                            $c | kubectl apply -f -
                            Check "Failed to apply $file"
                        }

                        # Migrations first
                        kubectl delete job pactum-migrate -n $ns --ignore-not-found
                        Apply 'django-migration-job.yaml'
                        kubectl wait --for=condition=complete job/pactum-migrate -n $ns --timeout=10m
                        if ($LASTEXITCODE -ne 0) {
                            kubectl logs job/pactum-migrate -n $ns
                            throw 'Database migration failed.'
                        }

                        # Then the app
                        foreach ($f in 'backend-service.yaml', 'frontend-service.yaml',
                                       'backend-deployment.yaml', 'frontend-deployment.yaml') {
                            Apply $f
                        }

                        foreach ($d in 'backend', 'frontend') {
                            kubectl rollout status "deployment/pactum-$d" -n $ns --timeout=5m
                            if ($LASTEXITCODE -ne 0) {
                                kubectl get pods -n $ns
                                kubectl logs "deployment/pactum-$d" -n $ns --tail=100
                                throw "$d rollout failed."
                            }
                        }

                        kubectl get pods,svc -n $ns
                    '''
                }
            }
        }
    }

    post {
        success { echo "Pactum deployed. Image tag: ${env.IMAGE_TAG}" }
        failure { echo 'Pipeline failed. Check the failed stage log and CloudFormation stack Events.' }
    }
}