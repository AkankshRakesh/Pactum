
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')
    }

    parameters {
        string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region')
        string(name: 'STACK_NAME', defaultValue: 'pactum', description: 'CloudFormation stack')
        string(name: 'CLUSTER_NAME', defaultValue: 'pactum-eks', description: 'EKS cluster')
        string(name: 'KUBERNETES_VERSION', defaultValue: '1.33', description: 'EKS version')
        string(name: 'S3_BUCKET_NAME', defaultValue: '', description: 'S3 bucket name')
        string(name: 'EKS_PUBLIC_ACCESS_CIDRS', defaultValue: '', description: 'Allowed API CIDRs')
        string(name: 'ACM_CERTIFICATE_ARN', defaultValue: '', description: 'Optional certificate ARN')
        string(name: 'DB_NAME', defaultValue: 'pactum', description: 'Database name')
        string(name: 'DB_USERNAME', defaultValue: 'pactumadmin', description: 'Database username')
        string(name: 'DB_INSTANCE_CLASS', defaultValue: 'db.t3.micro', description: 'RDS instance class')
        string(name: 'NODE_INSTANCE_TYPES', defaultValue: 't3.medium', description: 'EKS node type')
        string(name: 'DESIRED_NODES', defaultValue: '2', description: 'Desired node count')
        string(name: 'MAX_NODES', defaultValue: '3', description: 'Maximum node count')
        string(name: 'BACKEND_IMAGE', defaultValue: '', description: 'Docker Hub username/pactum-backend')
        string(name: 'FRONTEND_IMAGE', defaultValue: '', description: 'Docker Hub username/pactum-frontend')
        string(name: 'DJANGO_ALLOWED_HOSTS', defaultValue: '*', description: 'Django allowed hosts')
        string(name: 'CSRF_TRUSTED_ORIGINS', defaultValue: '', description: 'Comma-separated trusted origins')
        string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: '/api', description: 'Frontend API URL')
    }

    environment {
        AWS_DEFAULT_REGION = "${params.AWS_REGION}"
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
                        'frontend/package.json',
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

                    foreach ($name in @(
                        'S3_BUCKET_NAME',
                        'EKS_PUBLIC_ACCESS_CIDRS',
                        'BACKEND_IMAGE',
                        'FRONTEND_IMAGE'
                    )) {
                        if ([string]::IsNullOrWhiteSpace(
                            [Environment]::GetEnvironmentVariable($name)
                        )) {
                            throw "Set Jenkins parameter $name"
                        }
                    }

                    docker info
                    if ($LASTEXITCODE -ne 0) {
                        throw 'Docker is unavailable'
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
                        $ErrorActionPreference = 'Stop'

                        $backendTag = "$env:BACKEND_IMAGE`:$env:IMAGE_TAG"
                        $frontendTag = "$env:FRONTEND_IMAGE`:$env:IMAGE_TAG"

                        $env:DOCKERHUB_PASS |
                            docker login -u $env:DOCKERHUB_USER --password-stdin

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Docker Hub login failed'
                        }

                        try {
                            docker build --target runtime -t $backendTag backend
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend image build failed'
                            }

                            docker build -t $frontendTag `
                                --build-arg "NEXT_PUBLIC_API_BASE_URL=$env:NEXT_PUBLIC_API_BASE_URL" `
                                frontend

                            if ($LASTEXITCODE -ne 0) {
                                throw 'Frontend image build failed'
                            }

                            docker push $backendTag
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Backend image push failed'
                            }

                            docker push $frontendTag
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Frontend image push failed'
                            }
                        }
                        finally {
                            docker logout
                        }
                    '''
                }
            }
        }

        stage('Provision AWS Infrastructure') {
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
                            throw 'AWS credentials are invalid'
                        }

                        $overrides = @(
                            "ClusterName=$env:CLUSTER_NAME",
                            "KubernetesVersion=$env:KUBERNETES_VERSION",
                            "EksPublicAccessCidrs=$env:EKS_PUBLIC_ACCESS_CIDRS",
                            "DbName=$env:DB_NAME",
                            "DbUsername=$env:DB_USERNAME",
                            "DbInstanceClass=$env:DB_INSTANCE_CLASS",
                            "NodeInstanceTypes=$env:NODE_INSTANCE_TYPES",
                            "DesiredNodes=$env:DESIRED_NODES",
                            "MaxNodes=$env:MAX_NODES",
                            "ContractsBucketName=$env:S3_BUCKET_NAME",
                            "AcmCertificateArn=$env:ACM_CERTIFICATE_ARN"
                        )

                        aws cloudformation deploy `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --template-file infra/cloudformation/pactum.yaml `
                            --capabilities CAPABILITY_NAMED_IAM `
                            --parameter-overrides $overrides `
                            --no-fail-on-empty-changeset

                        if ($LASTEXITCODE -ne 0) {
                            throw 'CloudFormation deployment failed'
                        }

                        aws eks update-kubeconfig `
                            --region $env:AWS_REGION `
                            --name $env:CLUSTER_NAME

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not configure EKS access'
                        }

                        kubectl get nodes
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Cannot access EKS cluster'
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
                    string(
                        credentialsId: 'pactum-django-secret-key',
                        variable: 'DJANGO_SECRET_KEY'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        $outputs = aws cloudformation describe-stacks `
                            --region $env:AWS_REGION `
                            --stack-name $env:STACK_NAME `
                            --query 'Stacks[0].Outputs' `
                            --output json | ConvertFrom-Json

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not read CloudFormation outputs'
                        }

                        $out = @{}
                        foreach ($item in $outputs) {
                            $out[$item.OutputKey] = $item.OutputValue
                        }

                        if (-not $out['DbSecretArn']) {
                            throw 'CloudFormation output DbSecretArn is missing'
                        }

                        $db = aws secretsmanager get-secret-value `
                            --region $env:AWS_REGION `
                            --secret-id $out['DbSecretArn'] `
                            --query SecretString `
                            --output text | ConvertFrom-Json

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not retrieve database credentials'
                        }

                        kubectl create namespace $env:K8S_NAMESPACE `
                            --dry-run=client -o yaml | kubectl apply -f -

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Namespace creation failed'
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
                            throw 'Could not generate application Secret'
                        }

                        $secretYaml | kubectl apply -f -
                        if ($LASTEXITCODE -ne 0) {
                            throw 'Could not apply application Secret'
                        }

                        $temp = Join-Path $env:TEMP (
                            'pactum-' + [guid]::NewGuid().ToString('N')
                        )
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
                                    throw "Missing manifest: $source"
                                }

                                $content = Get-Content $source -Raw
                                $content = $content.Replace(
                                    'BACKEND_IMAGE_PLACEHOLDER',
                                    "$env:BACKEND_IMAGE`:$env:IMAGE_TAG"
                                )
                                $content = $content.Replace(
                                    'FRONTEND_IMAGE_PLACEHOLDER',
                                    "$env:FRONTEND_IMAGE`:$env:IMAGE_TAG"
                                )
                                $content = $content.Replace(
                                    'AWS_REGION_PLACEHOLDER',
                                    $env:AWS_REGION
                                )
                                $content = $content.Replace(
                                    'S3_BUCKET_PLACEHOLDER',
                                    $out['ContractsBucketName']
                                )

                                Set-Content `
                                    -Path (Join-Path $temp $file) `
                                    -Value $content `
                                    -Encoding utf8
                            }

                            kubectl delete job pactum-migrate `
                                -n $env:K8S_NAMESPACE --ignore-not-found

                            if ($LASTEXITCODE -ne 0) {
                                throw 'Could not remove previous migration Job'
                            }

                            kubectl apply -f (Join-Path $temp 'django-migration-job.yaml')
                            if ($LASTEXITCODE -ne 0) {
                                throw 'Migration Job creation failed'
                            }

                            kubectl wait `
                                --for=condition=complete `
                                job/pactum-migrate `
                                -n $env:K8S_NAMESPACE `
                                --timeout=10m

                            if ($LASTEXITCODE -ne 0) {
                                kubectl logs job/pactum-migrate -n $env:K8S_NAMESPACE
                                throw 'Database migration failed'
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

                            kubectl rollout status deployment/pactum-backend `
                                -n $env:K8S_NAMESPACE --timeout=5m

                            if ($LASTEXITCODE -ne 0) {
                                kubectl get pods -n $env:K8S_NAMESPACE
                                kubectl logs deployment/pactum-backend `
                                    -n $env:K8S_NAMESPACE --tail=100
                                throw 'Backend rollout failed'
                            }

                            kubectl rollout status deployment/pactum-frontend `
                                -n $env:K8S_NAMESPACE --timeout=5m

                            if ($LASTEXITCODE -ne 0) {
                                kubectl get pods -n $env:K8S_NAMESPACE
                                kubectl logs deployment/pactum-frontend `
                                    -n $env:K8S_NAMESPACE --tail=100
                                throw 'Frontend rollout failed'
                            }

                            kubectl get deployments,pods,services `
                                -n $env:K8S_NAMESPACE
                        }
                        finally {
                            Remove-Item $temp -Recurse -Force `
                                -ErrorAction SilentlyContinue
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
            echo 'Pipeline failed. Check the failed stage in the console log.'

            withCredentials([
                usernamePassword(
                    credentialsId: 'aws-creds',
                    usernameVariable: 'AWS_ACCESS_KEY_ID',
                    passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                )
            ]) {
                powershell '''
                    $ErrorActionPreference = 'Continue'

                    aws eks describe-cluster `
                        --region $env:AWS_REGION `
                        --name $env:CLUSTER_NAME *> $null

                    if ($LASTEXITCODE -eq 0) {
                        aws eks update-kubeconfig `
                            --region $env:AWS_REGION `
                            --name $env:CLUSTER_NAME

                        if ($LASTEXITCODE -eq 0) {
                            kubectl get pods -n $env:K8S_NAMESPACE
                            kubectl get events -n $env:K8S_NAMESPACE `
                                --sort-by=.metadata.creationTimestamp
                        }
                    }
                    else {
                        Write-Host 'EKS cluster is not available; skipping diagnostics.'
                    }
                '''
            }
        }

        always {
            powershell '''
                docker image prune -f
            '''
        }
    }
}
