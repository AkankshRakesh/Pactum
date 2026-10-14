pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')
    }

    environment {
        // Hard-coded deployment defaults. Change these here, not in the Jenkins UI.
        AWS_REGION = 'ap-south-1'
        AWS_DEFAULT_REGION = 'ap-south-1'
        STACK_NAME = 'pactum'
        CLUSTER_NAME = 'pactum-eks'
        KUBERNETES_VERSION = '1.33'
        DB_NAME = 'pactum'
        DB_USERNAME = 'pactumadmin'
        DB_INSTANCE_CLASS = 'db.t3.micro'
        NODE_INSTANCE_TYPES = 't3.medium'
        DESIRED_NODES = '2'
        MAX_NODES = '3'
        DJANGO_ALLOWED_HOSTS = '*'
        CSRF_TRUSTED_ORIGINS = ''
        NEXT_PUBLIC_API_BASE_URL = '/api'
        K8S_NAMESPACE = 'pactum'
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

                    echo "Image tag: ${env.IMAGE_TAG}"
                }

                powershell '''
                    $ErrorActionPreference = 'Stop'

                    foreach ($tool in @('aws', 'kubectl', 'docker')) {
                        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
                            throw "Missing required tool: $tool"
                        }
                    }

                    foreach ($path in @(
                        'backend/manage.py',
                        'backend/Dockerfile',
                        'frontend/package.json',
                        'frontend/Dockerfile',
                        'infra/cloudformation/pactum.yaml',
                        'deploy/kubernetes/backend-deployment.yaml',
                        'deploy/kubernetes/backend-service.yaml',
                        'deploy/kubernetes/frontend-deployment.yaml',
                        'deploy/kubernetes/frontend-service.yaml',
                        'deploy/kubernetes/django-migration-job.yaml'
                    )) {
                        if (-not (Test-Path $path)) {
                            throw "Missing required file: $path"
                        }
                    }

                    docker info
                    if ($LASTEXITCODE -ne 0) {
                        throw 'Docker is unavailable. Ensure Docker Desktop is running in Linux-container mode.'
                    }
                '''
            }
        }

        stage('Build and Push Images') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKERHUB_USER',
                        passwordVariable: 'DOCKERHUB_PASS'
                    )
                ]) {
                    powershell '''
                        $backendImage = "$($env:DOCKERHUB_USER)/pactum-backend:$($env:IMAGE_TAG)"
                        $frontendImage = "$($env:DOCKERHUB_USER)/pactum-frontend:$($env:IMAGE_TAG)"

                        Write-Host "Building backend image: $backendImage"
                        docker build -f backend/Dockerfile -t $backendImage backend
                        if ($LASTEXITCODE -ne 0) {
                            throw "Backend Docker build failed."
                        }

                        Write-Host "Building frontend image: $frontendImage"
                        docker build -f frontend/Dockerfile -t $frontendImage frontend
                        if ($LASTEXITCODE -ne 0) {
                            throw "Frontend Docker build failed."
                        }

                        Write-Host "Pushing backend image..."
                        docker push $backendImage
                        if ($LASTEXITCODE -ne 0) {
                            throw "Backend Docker push failed."
                        }

                        Write-Host "Pushing frontend image..."
                        docker push $frontendImage
                        if ($LASTEXITCODE -ne 0) {
                            throw "Frontend Docker push failed."
                        }

                        Write-Host "Both images built and pushed successfully."
                    '''
                }
            }
        }

        stage('Provision AWS with CloudFormation') {
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

                        aws sts get-caller-identity
                        if ($LASTEXITCODE -ne 0) {
                            throw 'AWS credentials are invalid or missing.'
                        }

                        $accountId = (aws sts get-caller-identity --query Account --output text).Trim()
                        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountId)) {
                            throw 'Could not determine the AWS account ID.'
                        }

                        # Deterministic, account-specific name; no manual S3 bucket input required.
                        $bucketName = "pactum-contracts-$accountId-$($env:AWS_REGION)"

                        # Restrict the EKS public API to the Jenkins host's current public egress IP.
                        # This avoids opening the Kubernetes API to 0.0.0.0/0.
                        try {
                            $publicIp = (Invoke-RestMethod -Uri 'https://checkip.amazonaws.com' -TimeoutSec 15).Trim()
                            $parsedIp = $null
                            if (-not [System.Net.IPAddress]::TryParse($publicIp, [ref]$parsedIp)) {
                                throw "Invalid public IP returned: $publicIp"
                            }
                            $apiCidr = "$publicIp/32"
                        }
                        catch {
                            throw "Could not determine Jenkins public IP. CloudFormation was not started. Details: $($_.Exception.Message)"
                        }

                        Write-Host "AWS account: $accountId"
                        Write-Host "S3 bucket: $bucketName"
                        Write-Host "EKS API allowlist: $apiCidr"

                        $overrides = @(
                            "ClusterName=$env:CLUSTER_NAME",
                            "KubernetesVersion=$env:KUBERNETES_VERSION",
                            "EksPublicAccessCidrs=$apiCidr",
                            "DbName=$env:DB_NAME",
                            "DbUsername=$env:DB_USERNAME",
                            "DbInstanceClass=$env:DB_INSTANCE_CLASS",
                            "NodeInstanceTypes=$env:NODE_INSTANCE_TYPES",
                            "DesiredNodes=$env:DESIRED_NODES",
                            "MaxNodes=$env:MAX_NODES",
                            "ContractsBucketName=$bucketName"
                        )

                        aws cloudformation deploy `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --template-file infra/cloudformation/pactum.yaml `
                            --capabilities CAPABILITY_NAMED_IAM `
                            --parameter-overrides $overrides `
                            --no-fail-on-empty-changeset

                        if ($LASTEXITCODE -ne 0) {
                            throw 'CloudFormation deployment failed. Check the stack Events in AWS CloudFormation.'
                        }

                        aws eks update-kubeconfig `
                            --region $env:AWS_REGION `
                            --name $env:CLUSTER_NAME
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not configure kubectl for the EKS cluster.'
                        }

                        kubectl get nodes
                        if ($LASTEXITCODE -ne 0) {
                            throw 'kubectl cannot access the EKS cluster. Check EKS access permissions and the Jenkins public IP allowlist.'
                        }
                    '''
                }
            }
        }

        stage('Deploy Application') {
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
                        credentialsId: 'pactum-django-secret-key',
                        variable: 'DJANGO_SECRET_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        # Read actual resource values from the deployed CloudFormation stack.
                        $outputsJson = aws cloudformation describe-stacks `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --query 'Stacks[0].Outputs' `
                            --output json

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not read CloudFormation outputs.'
                        }

                        $outputs = $outputsJson | ConvertFrom-Json
                        $out = @{}
                        foreach ($item in $outputs) {
                            $out[$item.OutputKey] = $item.OutputValue
                        }

                        foreach ($requiredOutput in @(
                            'ClusterName', 'DbSecretArn', 'DbName',
                            'DbEndpoint', 'DbPort', 'ContractsBucketName'
                        )) {
                            if ([string]::IsNullOrWhiteSpace($out[$requiredOutput])) {
                                throw "Required CloudFormation output is missing: $requiredOutput"
                            }
                        }

                        aws eks update-kubeconfig `
                            --region $env:AWS_REGION `
                            --name $out['ClusterName']
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not configure kubectl for the CloudFormation EKS cluster.'
                        }

                        $dbJson = aws secretsmanager get-secret-value `
                            --region $env:AWS_REGION `
                            --secret-id $out['DbSecretArn'] `
                            --query SecretString `
                            --output text

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not retrieve database credentials from Secrets Manager.'
                        }
                        $db = $dbJson | ConvertFrom-Json

                        kubectl create namespace $env:K8S_NAMESPACE --dry-run=client -o yaml |
                            kubectl apply -f -
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Namespace creation failed.'
                        }

                        $secretArgs = @(
                            'create', 'secret', 'generic', 'pactum-app-secrets',
                            '-n', $env:K8S_NAMESPACE,
                            "--from-literal=DJANGO_SECRET_KEY=$env:DJANGO_SECRET_KEY",
                            '--from-literal=DJANGO_DEBUG=False',
                            "--from-literal=DJANGO_ALLOWED_HOSTS=$env:DJANGO_ALLOWED_HOSTS",
                            "--from-literal=CSRF_TRUSTED_ORIGINS=$env:CSRF_TRUSTED_ORIGINS",
                            "--from-literal=DB_NAME=$($out['DbName'])",
                            "--from-literal=DB_USER=$($db.username)",
                            "--from-literal=DB_PASSWORD=$($db.password)",
                            "--from-literal=DB_HOST=$($out['DbEndpoint'])",
                            "--from-literal=DB_PORT=$($out['DbPort'])",
                            '--from-literal=DB_SSLMODE=require',
                            '--dry-run=client', '-o', 'yaml'
                        )

                        $secretYaml = & kubectl @secretArgs
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not generate the Kubernetes application Secret.'
                        }

                        $secretYaml | kubectl apply -f -
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not apply the Kubernetes application Secret.'
                        }

                        $backendTag = '{0}/pactum-backend:{1}' -f $env:DOCKERHUB_USER, $env:IMAGE_TAG
                        $frontendTag = '{0}/pactum-frontend:{1}' -f $env:DOCKERHUB_USER, $env:IMAGE_TAG

                        $temp = Join-Path $env:TEMP ('pactum-' + [guid]::NewGuid().ToString('N'))
                        New-Item -ItemType Directory -Path $temp | Out-Null

                        try {
                            $files = @(
                                'backend-deployment.yaml',
                                'backend-service.yaml',
                                'frontend-deployment.yaml',
                                'frontend-service.yaml',
                                'django-migration-job.yaml'
                            )

                            foreach ($file in $files) {
                                $source = Join-Path 'deploy/kubernetes' $file
                                if (-not (Test-Path $source)) {
                                    throw "Missing Kubernetes manifest: $source"
                                }

                                $content = Get-Content $source -Raw
                                $content = $content.Replace('BACKEND_IMAGE_PLACEHOLDER', $backendTag)
                                $content = $content.Replace('FRONTEND_IMAGE_PLACEHOLDER', $frontendTag)
                                $content = $content.Replace('AWS_REGION_PLACEHOLDER', $env:AWS_REGION)
                                $content = $content.Replace('S3_BUCKET_PLACEHOLDER', $out['ContractsBucketName'])

                                Set-Content -Path (Join-Path $temp $file) -Value $content -Encoding utf8
                            }

                            # Run database migrations before rolling out the new application version.
                            kubectl delete job pactum-migrate -n $env:K8S_NAMESPACE --ignore-not-found
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Could not remove the previous migration Job.'
                            }

                            kubectl apply -f (Join-Path $temp 'django-migration-job.yaml')
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Could not create the migration Job.'
                            }

                            kubectl wait --for=condition=complete job/pactum-migrate `
                                -n $env:K8S_NAMESPACE --timeout=10m
                            if ($LASTEXITCODE -ne 0) {
                                kubectl logs job/pactum-migrate -n $env:K8S_NAMESPACE
                                throw 'Database migration failed.'
                            }

                            foreach ($file in @(
                                'backend-service.yaml',
                                'frontend-service.yaml',
                                'backend-deployment.yaml',
                                'frontend-deployment.yaml'
                            )) {
                                kubectl apply -f (Join-Path $temp $file)
                                if ($LASTEXITCODE -ne 0) {
                                    throw "Failed to apply $file"
                                }
                            }

                            # Apply autoscaling manifests only if they exist in the repository.
                            foreach ($file in @('backend-hpa.yaml', 'frontend-hpa.yaml')) {
                                $source = Join-Path 'deploy/kubernetes' $file
                                if (Test-Path $source) {
                                    $content = Get-Content $source -Raw
                                    $content = $content.Replace('BACKEND_IMAGE_PLACEHOLDER', $backendTag)
                                    $content = $content.Replace('FRONTEND_IMAGE_PLACEHOLDER', $frontendTag)
                                    Set-Content -Path (Join-Path $temp $file) -Value $content -Encoding utf8
                                    kubectl apply -f (Join-Path $temp $file)
                                    if ($LASTEXITCODE -ne 0) {
                                        throw "Failed to apply $file"
                                    }
                                }
                            }

                            kubectl rollout status deployment/pactum-backend `
                                -n $env:K8S_NAMESPACE --timeout=5m
                            if ($LASTEXITCODE -ne 0) {
                                kubectl get pods -n $env:K8S_NAMESPACE
                                kubectl logs deployment/pactum-backend -n $env:K8S_NAMESPACE --tail=100
                                throw 'Backend rollout failed.'
                            }

                            kubectl rollout status deployment/pactum-frontend `
                                -n $env:K8S_NAMESPACE --timeout=5m
                            if ($LASTEXITCODE -ne 0) {
                                kubectl get pods -n $env:K8S_NAMESPACE
                                kubectl logs deployment/pactum-frontend -n $env:K8S_NAMESPACE --tail=100
                                throw 'Frontend rollout failed.'
                            }

                            kubectl get deployments,pods,services,hpa -n $env:K8S_NAMESPACE
                            Write-Host "Database endpoint: $($out['DbEndpoint'])"
                            Write-Host "Contracts bucket: $($out['ContractsBucketName'])"
                        }
                        finally {
                            Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
                        }
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Pactum deployment succeeded. Image tag: ${env.IMAGE_TAG}"
        }

        failure {
            echo 'Pipeline failed. Inspect the failed stage and CloudFormation stack Events.'

            withCredentials([
                usernamePassword(
                    credentialsId: 'aws-creds',
                    usernameVariable: 'AWS_ACCESS_KEY_ID',
                    passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                )
            ]) {
                powershell '''
                    $ErrorActionPreference = 'Continue'

                    aws eks describe-cluster --region $env:AWS_REGION --name $env:CLUSTER_NAME *> $null
                    if ($LASTEXITCODE -eq 0) {
                        aws eks update-kubeconfig --region $env:AWS_REGION --name $env:CLUSTER_NAME
                        if ($LASTEXITCODE -eq 0) {
                            kubectl get pods -n $env:K8S_NAMESPACE
                            kubectl get events -n $env:K8S_NAMESPACE --sort-by=.metadata.creationTimestamp
                        }
                    }
                    else {
                        Write-Host 'EKS cluster is not available; skipping Kubernetes diagnostics.'
                    }
                '''
            }
        }

        always {
            powershell '''
                docker image prune -f
                if ($LASTEXITCODE -ne 0) {
                    Write-Host 'Docker cleanup failed; continuing.'
                }
            '''
        }
    }
}
