
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 90, unit: 'MINUTES')
  }

  parameters {
    string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region')
    string(name: 'STACK_NAME', defaultValue: 'pactum', description: 'CloudFormation stack')
    string(name: 'CLUSTER_NAME', defaultValue: 'pactum-eks', description: 'EKS cluster')
    string(name: 'KUBERNETES_VERSION', defaultValue: '1.33', description: 'Supported EKS version')
    string(name: 'S3_BUCKET_NAME', defaultValue: '', description: 'Globally unique S3 bucket name')
    string(name: 'EKS_PUBLIC_ACCESS_CIDRS', defaultValue: '', description: 'Restricted EKS API CIDR allowlist')
    string(name: 'ACM_CERTIFICATE_ARN', defaultValue: '', description: 'Optional ACM certificate ARN')
    string(name: 'DB_NAME', defaultValue: 'pactum', description: 'RDS database name')
    string(name: 'DB_USERNAME', defaultValue: 'pactumadmin', description: 'RDS username')
    string(name: 'DB_INSTANCE_CLASS', defaultValue: 'db.t3.micro', description: 'RDS instance class')
    string(name: 'NODE_INSTANCE_TYPES', defaultValue: 't3.medium', description: 'EKS node instance types')
    string(name: 'DESIRED_NODES', defaultValue: '2', description: 'Desired EKS nodes')
    string(name: 'MAX_NODES', defaultValue: '3', description: 'Maximum EKS nodes')
    string(name: 'BACKEND_IMAGE', defaultValue: '', description: 'Docker Hub image, e.g. username/pactum-backend')
    string(name: 'FRONTEND_IMAGE', defaultValue: '', description: 'Docker Hub image, e.g. username/pactum-frontend')
    string(name: 'DJANGO_ALLOWED_HOSTS', defaultValue: '*', description: 'Production Django allowed hosts')
    string(name: 'CSRF_TRUSTED_ORIGINS', defaultValue: '', description: 'Comma-separated trusted origins')
    string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: '/api', description: 'Frontend API base URL')
  }

  environment {
    AWS_DEFAULT_REGION = "${params.AWS_REGION}"
    K8S_NAMESPACE = 'pactum'
  }

  stages {
    stage('Checkout and validate') {
      steps {
        checkout scm

        script {
          env.IMAGE_TAG = powershell(
            returnStdout: true,
            script: 'git rev-parse --short=12 HEAD'
          ).trim()

          if (!env.IMAGE_TAG) {
            error('Could not determine Git commit SHA')
          }

          echo "Image tag: ${env.IMAGE_TAG}"
        }

        powershell '''
          $ErrorActionPreference = 'Stop'

          foreach ($tool in @('aws', 'kubectl', 'docker', 'eksctl', 'trivy', 'npm')) {
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
            'deploy/kubernetes/django-migration-job.yaml',
            'deploy/kubernetes/ingress.yaml'
          )) {
            if (-not (Test-Path $path)) {
              throw "Missing required file: $path"
            }
          }

          foreach ($name in @('S3_BUCKET_NAME', 'EKS_PUBLIC_ACCESS_CIDRS', 'BACKEND_IMAGE', 'FRONTEND_IMAGE')) {
            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
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

    stage('Test') {
      parallel {
        stage('Django tests') {
          steps {
            powershell '''
              $ErrorActionPreference = 'Stop'

              docker build --target test -t "pactum-backend-test:$env:IMAGE_TAG" backend
              if ($LASTEXITCODE -ne 0) {
                throw 'Backend test image build failed. Check the backend Dockerfile test target.'
              }

              docker run --rm "pactum-backend-test:$env:IMAGE_TAG"
              if ($LASTEXITCODE -ne 0) {
                throw 'Django tests failed'
              }
            '''
          }
        }

        stage('Frontend lint and build') {
          steps {
            dir('frontend') {
              powershell '''
                $ErrorActionPreference = 'Stop'

                npm ci
                if ($LASTEXITCODE -ne 0) {
                  throw 'npm ci failed'
                }

                npm run lint --if-present
                if ($LASTEXITCODE -ne 0) {
                  throw 'Frontend lint failed'
                }

                npm run build
                if ($LASTEXITCODE -ne 0) {
                  throw 'Frontend build failed'
                }
              '''
            }
          }
        }
      }
    }

    stage('Build, scan and push images') {
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

            $backendTag = "${env:BACKEND_IMAGE}:$env:IMAGE_TAG"
            $frontendTag = "${env:FRONTEND_IMAGE}:$env:IMAGE_TAG"

            $env:DOCKERHUB_PASS | docker login -u $env:DOCKERHUB_USER --password-stdin
            if ($LASTEXITCODE -ne 0) {
              throw 'Docker Hub login failed'
            }

            docker build --target runtime -t $backendTag backend
            if ($LASTEXITCODE -ne 0) {
              throw 'Backend image build failed. Check the backend Dockerfile runtime target.'
            }

            docker build -t $frontendTag --build-arg "NEXT_PUBLIC_API_BASE_URL=$env:NEXT_PUBLIC_API_BASE_URL" frontend
            if ($LASTEXITCODE -ne 0) {
              throw 'Frontend image build failed'
            }

            trivy image --exit-code 1 --severity HIGH,CRITICAL $backendTag
            if ($LASTEXITCODE -ne 0) {
              throw 'Backend image scan failed'
            }

            trivy image --exit-code 1 --severity HIGH,CRITICAL $frontendTag
            if ($LASTEXITCODE -ne 0) {
              throw 'Frontend image scan failed'
            }

            docker push $backendTag
            if ($LASTEXITCODE -ne 0) {
              throw 'Backend image push failed'
            }

            docker push $frontendTag
            if ($LASTEXITCODE -ne 0) {
              throw 'Frontend image push failed'
            }

            docker logout
          '''
        }
      }
    }

    stage('Provision infrastructure') {
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

            aws cloudformation deploy --region $env:AWS_REGION --stack-name $env:STACK_NAME --template-file infra/cloudformation/pactum.yaml --capabilities CAPABILITY_NAMED_IAM --parameter-overrides $overrides --no-fail-on-empty-changeset
            if ($LASTEXITCODE -ne 0) {
              throw 'CloudFormation deployment failed. Verify the template parameter names.'
            }

            aws eks update-kubeconfig --region $env:AWS_REGION --name $env:CLUSTER_NAME
            if ($LASTEXITCODE -ne 0) {
              throw 'EKS kubeconfig update failed'
            }

            kubectl get nodes
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot access EKS cluster'
            }
          '''
        }
      }
    }

    stage('Install AWS Load Balancer Controller') {
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

            $outputs = aws cloudformation describe-stacks --region $env:AWS_REGION --stack-name $env:STACK_NAME --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot read CloudFormation outputs'
            }

            $out = @{}
            foreach ($item in $outputs) {
              $out[$item.OutputKey] = $item.OutputValue
            }

            $vpcId = $out['VpcId']
            if ([string]::IsNullOrWhiteSpace($vpcId)) {
              throw 'CloudFormation output VpcId is missing. Add it to the template outputs.'
            }

            $account = aws sts get-caller-identity --query Account --output text
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot identify AWS account'
            }

            $policyName = "AWSLoadBalancerControllerIAMPolicy-$env:CLUSTER_NAME"
            $policyArn = "arn:aws:iam::${account}:policy/${policyName}"
            $policyFile = Join-Path $env:TEMP 'aws-lbc-iam-policy.json'
            $manifestFile = Join-Path $env:TEMP 'aws-lbc-full.yaml'

            try {
              Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json' -OutFile $policyFile

              aws iam get-policy --policy-arn $policyArn *> $null
              if ($LASTEXITCODE -ne 0) {
                aws iam create-policy --policy-name $policyName --policy-document "file://$policyFile"
                if ($LASTEXITCODE -ne 0) {
                  throw 'Could not create AWS Load Balancer Controller IAM policy'
                }
              }

              eksctl utils associate-iam-oidc-provider --region $env:AWS_REGION --cluster $env:CLUSTER_NAME --approve
              if ($LASTEXITCODE -ne 0) {
                throw 'Could not associate EKS OIDC provider'
              }

              eksctl create iamserviceaccount --cluster $env:CLUSTER_NAME --region $env:AWS_REGION --namespace kube-system --name aws-load-balancer-controller --role-name pactum-aws-load-balancer-controller-role --attach-policy-arn $policyArn --approve --override-existing-serviceaccounts
              if ($LASTEXITCODE -ne 0) {
                throw 'Could not create the controller IAM service account'
              }

              Invoke-WebRequest -Uri 'https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v2.13.3/v2_13_3_full.yaml' -OutFile $manifestFile

              $manifest = Get-Content $manifestFile -Raw
              $manifest = $manifest.Replace('your-cluster-name', $env:CLUSTER_NAME)
              $manifest = $manifest.Replace('region-code', $env:AWS_REGION)
              $manifest = $manifest.Replace('vpc-xxxxxxxx', $vpcId)
              Set-Content -Path $manifestFile -Value $manifest -Encoding utf8

              kubectl apply -f $manifestFile
              if ($LASTEXITCODE -ne 0) {
                throw 'Could not apply AWS Load Balancer Controller manifests'
              }

              kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=5m
              if ($LASTEXITCODE -ne 0) {
                throw 'AWS Load Balancer Controller deployment is not ready'
              }
            }
            finally {
              Remove-Item $policyFile -Force -ErrorAction SilentlyContinue
              Remove-Item $manifestFile -Force -ErrorAction SilentlyContinue
            }
          '''
        }
      }
    }

    stage('Deploy Kubernetes resources') {
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

            $outputs = aws cloudformation describe-stacks --region $env:AWS_REGION --stack-name $env:STACK_NAME --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot read CloudFormation outputs'
            }

            $out = @{}
            foreach ($item in $outputs) {
              $out[$item.OutputKey] = $item.OutputValue
            }

            $db = aws secretsmanager get-secret-value --region $env:AWS_REGION --secret-id $out['DbSecretArn'] --query SecretString --output text | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot retrieve RDS credentials'
            }

            kubectl create namespace pactum --dry-run=client -o yaml | kubectl apply -f -
            if ($LASTEXITCODE -ne 0) {
              throw 'Namespace setup failed'
            }

            $secretArgs = @(
              'create', 'secret', 'generic', 'pactum-app-secrets',
              '-n', 'pactum',
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

            $temp = Join-Path $env:TEMP ('pactum-' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $temp | Out-Null

            try {
              $files = @(
                'namespace.yaml',
                'backend-deployment.yaml',
                'backend-service.yaml',
                'frontend-deployment.yaml',
                'frontend-service.yaml',
                'backend-hpa.yaml',
                'frontend-hpa.yaml',
                'ingress.yaml',
                'django-migration-job.yaml'
              )

              foreach ($file in $files) {
                $source = Join-Path 'deploy/kubernetes' $file
                if (-not (Test-Path $source)) {
                  throw "Missing Kubernetes manifest: $source"
                }

                $content = Get-Content $source -Raw
                $content = $content.Replace('BACKEND_IMAGE_PLACEHOLDER', "${env:BACKEND_IMAGE}:$env:IMAGE_TAG")
                $content = $content.Replace('FRONTEND_IMAGE_PLACEHOLDER', "${env:FRONTEND_IMAGE}:$env:IMAGE_TAG")
                $content = $content.Replace('AWS_REGION_PLACEHOLDER', $env:AWS_REGION)
                $content = $content.Replace('S3_BUCKET_PLACEHOLDER', $out['ContractsBucketName'])

                Set-Content -Path (Join-Path $temp $file) -Value $content -Encoding utf8
              }

              kubectl delete job pactum-migrate -n pactum --ignore-not-found

              kubectl apply -f (Join-Path $temp 'django-migration-job.yaml')
              if ($LASTEXITCODE -ne 0) {
                throw 'Migration Job creation failed'
              }

              kubectl wait --for=condition=complete job/pactum-migrate -n pactum --timeout=10m
              if ($LASTEXITCODE -ne 0) {
                kubectl logs job/pactum-migrate -n pactum
                throw 'Django migrations failed'
              }

              foreach ($file in @(
                'backend-service.yaml',
                'frontend-service.yaml',
                'backend-deployment.yaml',
                'frontend-deployment.yaml',
                'backend-hpa.yaml',
                'frontend-hpa.yaml',
                'ingress.yaml'
              )) {
                kubectl apply -f (Join-Path $temp $file)
                if ($LASTEXITCODE -ne 0) {
                  throw "Apply failed: $file"
                }
              }

              kubectl rollout status deployment/pactum-backend -n pactum --timeout=5m
              if ($LASTEXITCODE -ne 0) {
                kubectl get pods -n pactum
                kubectl logs deployment/pactum-backend -n pactum --tail=100
                throw 'Backend rollout failed'
              }

              kubectl rollout status deployment/pactum-frontend -n pactum --timeout=5m
              if ($LASTEXITCODE -ne 0) {
                kubectl get pods -n pactum
                kubectl logs deployment/pactum-frontend -n pactum --tail=100
                throw 'Frontend rollout failed'
              }

              kubectl get ingress,deployments,pods,services,hpa -n pactum
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
      echo "Pactum deployment succeeded for image tag ${env.IMAGE_TAG}"
    }

    failure {
      echo 'Pipeline failed. Inspect the failed stage before retrying. Database migrations may already have changed the schema.'

      withCredentials([
        usernamePassword(
          credentialsId: 'aws-creds',
          usernameVariable: 'AWS_ACCESS_KEY_ID',
          passwordVariable: 'AWS_SECRET_ACCESS_KEY'
        )
      ]) {
        powershell '''
          $ErrorActionPreference = 'Continue'

          aws eks update-kubeconfig --region $env:AWS_REGION --name $env:CLUSTER_NAME

          if ($LASTEXITCODE -eq 0) {
            kubectl get pods -n pactum
            kubectl get events -n pactum --sort-by=.metadata.creationTimestamp
          }

          exit 0
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
