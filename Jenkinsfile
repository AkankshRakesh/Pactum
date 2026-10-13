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
    string(name: 'S3_BUCKET_NAME', defaultValue: '', description: 'Globally unique private S3 bucket')
    string(name: 'EKS_PUBLIC_ACCESS_CIDRS', defaultValue: '', description: 'Restricted CIDR allowlist for EKS API')
    string(name: 'ACM_CERTIFICATE_ARN', defaultValue: '', description: 'Optional ACM certificate ARN')
    string(name: 'DB_NAME', defaultValue: 'pactum', description: 'RDS database name')
    string(name: 'DB_USERNAME', defaultValue: 'pactumadmin', description: 'RDS username')
    string(name: 'DB_INSTANCE_CLASS', defaultValue: 'db.t3.micro', description: 'RDS instance class')
    string(name: 'NODE_INSTANCE_TYPES', defaultValue: 't3.medium', description: 'EKS node instance types')
    string(name: 'DESIRED_NODES', defaultValue: '2', description: 'Desired EKS nodes')
    string(name: 'MAX_NODES', defaultValue: '3', description: 'Maximum EKS nodes')
    string(name: 'BACKEND_IMAGE', defaultValue: '', description: 'Docker Hub image, e.g. username/pactum-backend')
    string(name: 'FRONTEND_IMAGE', defaultValue: '', description: 'Docker Hub image, e.g. username/pactum-frontend')
    string(name: 'DJANGO_ALLOWED_HOSTS', defaultValue: '*', description: 'Replace with exact production hosts')
    string(name: 'CSRF_TRUSTED_ORIGINS', defaultValue: '', description: 'Comma-separated trusted origins')
    string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: '/api', description: 'Browser-reachable API URL')
    booleanParam(name: 'DEPLOY_MONITORING', defaultValue: false, description: 'Install Prometheus/Grafana')
  }

  environment {
    AWS_DEFAULT_REGION = "${params.AWS_REGION}"
    K8S_NAMESPACE = 'pactum'
  }

  stages {
    stage('Checkout and validate') {
      steps {
        checkout scm

        powershell '''
          $ErrorActionPreference = 'Stop'

          foreach ($tool in @('aws','kubectl','docker','eksctl','trivy','npm')) {
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
              throw "Missing required tool: $tool"
            }
          }

          foreach ($path in @(
            'backend/manage.py',
            'frontend/package.json',
            'infra/cloudformation/pactum.yaml'
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

          aws sts get-caller-identity
          if ($LASTEXITCODE -ne 0) {
            throw 'AWS credentials are not available'
          }
        '''

        script {
          env.IMAGE_TAG = powershell(
            returnStdout: true,
            script: '(git rev-parse --short=12 HEAD)'
          ).trim()

          if (!env.IMAGE_TAG) {
            error('Could not determine Git commit SHA')
          }

          echo "Image tag: ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Build Helm Docker image') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'

          docker build `
            -t pactum-helm-aws:latest `
            infra/jenkins-tools/helm-aws

          if ($LASTEXITCODE -ne 0) {
            throw 'Failed to build Helm Docker image'
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
                throw 'Backend test image build failed'
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

            $backendTag = "$env:BACKEND_IMAGE`:$env:IMAGE_TAG"
            $frontendTag = "$env:FRONTEND_IMAGE`:$env:IMAGE_TAG"

            $env:DOCKERHUB_PASS |
              docker login -u $env:DOCKERHUB_USER --password-stdin

            if ($LASTEXITCODE -ne 0) {
              throw 'Docker Hub login failed'
            }

            docker build --target runtime -t $backendTag backend
            if ($LASTEXITCODE -ne 0) {
              throw 'Backend image build failed'
            }

            docker build -t $frontendTag `
              --build-arg "NEXT_PUBLIC_API_BASE_URL=$env:NEXT_PUBLIC_API_BASE_URL" frontend

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

    stage('Install cluster add-ons') {
      steps {
        echo 'Install AWS Load Balancer Controller using the official AWS EKS instructions and an IAM service-account role before applying ALB Ingress.'

        withCredentials([
          usernamePassword(
            credentialsId: 'aws-creds',
            usernameVariable: 'AWS_ACCESS_KEY_ID',
            passwordVariable: 'AWS_SECRET_ACCESS_KEY'
          )
        ]) {
          powershell '''
            $ErrorActionPreference = 'Stop'

            $account = aws sts get-caller-identity --query Account --output text
            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot identify AWS account'
            }

            $policyName = "AWSLoadBalancerControllerIAMPolicy-$env:CLUSTER_NAME"
            $policyArn = "arn:aws:iam::${account}:policy/${policyName}"
            $policyFile = Join-Path $env:TEMP 'aws-lbc-iam-policy.json'

            try {
              Invoke-WebRequest `
                -Uri 'https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json' `
                -OutFile $policyFile

              aws iam get-policy --policy-arn $policyArn *> $null

              if ($LASTEXITCODE -ne 0) {
                aws iam create-policy `
                  --policy-name $policyName `
                  --policy-document "file://$policyFile"

                if ($LASTEXITCODE -ne 0) {
                  throw 'Could not create ALB controller IAM policy'
                }
              } else {
                Write-Host 'ALB controller policy already exists; review policy updates separately.'
              }

              eksctl utils associate-iam-oidc-provider `
                --region $env:AWS_REGION `
                --cluster $env:CLUSTER_NAME `
                --approve

              if ($LASTEXITCODE -ne 0) {
                throw 'Could not associate EKS OIDC provider'
              }

              eksctl create iamserviceaccount `
                --cluster $env:CLUSTER_NAME `
                --region $env:AWS_REGION `
                --namespace kube-system `
                --name aws-load-balancer-controller `
                --attach-policy-arn $policyArn `
                --approve `
                --override-existing-serviceaccounts

              if ($LASTEXITCODE -ne 0) {
                throw 'Could not create ALB controller service account'
              }

              .\scripts\helm-docker.ps1 repo add eks https://aws.github.io/eks-charts
              if ($LASTEXITCODE -ne 0) {
                throw 'Could not add EKS Helm repository'
              }

              .\scripts\helm-docker.ps1 repo update
              if ($LASTEXITCODE -ne 0) {
                throw 'Helm repo update failed'
              }

              .\scripts\helm-docker.ps1 upgrade --install aws-load-balancer-controller `
                eks/aws-load-balancer-controller `
                --namespace kube-system `
                --set "clusterName=$env:CLUSTER_NAME" `
                --set serviceAccount.create=false `
                --set serviceAccount.name=aws-load-balancer-controller `
                --wait `
                --timeout 10m

              if ($LASTEXITCODE -ne 0) {
                throw 'ALB controller Helm install failed'
              }

              kubectl rollout status deployment/aws-load-balancer-controller `
                -n kube-system `
                --timeout=5m

              if ($LASTEXITCODE -ne 0) {
                throw 'ALB controller is not ready'
              }
            } finally {
              Remove-Item $policyFile -Force -ErrorAction SilentlyContinue
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
            $env:AWS_DEFAULT_REGION = $env:AWS_REGION

            $outputs = aws cloudformation describe-stacks `
              --region $env:AWS_REGION `
              --stack-name $env:STACK_NAME `
              --query 'Stacks[0].Outputs' `
              --output json | ConvertFrom-Json

            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot read CloudFormation outputs'
            }

            $out = @{}
            foreach ($item in $outputs) {
              $out[$item.OutputKey] = $item.OutputValue
            }

            $db = aws secretsmanager get-secret-value `
              --region $env:AWS_REGION `
              --secret-id $out['DbSecretArn'] `
              --query SecretString `
              --output text | ConvertFrom-Json

            if ($LASTEXITCODE -ne 0) {
              throw 'Cannot retrieve RDS credentials'
            }

            kubectl create namespace pactum --dry-run=client -o yaml |
              kubectl apply -f -

            if ($LASTEXITCODE -ne 0) {
              throw 'Namespace setup failed'
            }

            $secretArgs = @(
              'create',
              'secret',
              'generic',
              'pactum-app-secrets',
              '-n',
              'pactum',
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
              '--dry-run=client',
              '-o',
              'yaml'
            )

            $secretYaml = & kubectl @secretArgs
            if ($LASTEXITCODE -ne 0) {
              throw 'Could not generate app Secret'
            }

            $secretYaml | kubectl apply -f -
            if ($LASTEXITCODE -ne 0) {
              throw 'Could not apply app Secret'
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
                $content = Get-Content (Join-Path 'deploy/kubernetes' $file) -Raw

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
                ).Replace(
                  'S3_BUCKET_PLACEHOLDER',
                  $out['ContractsBucketName']
                )

                Set-Content `
                  -Path (Join-Path $temp $file) `
                  -Value $content `
                  -Encoding utf8
              }

              kubectl delete job pactum-migrate -n pactum --ignore-not-found

              kubectl apply -f (Join-Path $temp 'django-migration-job.yaml')
              if ($LASTEXITCODE -ne 0) {
                throw 'Migration Job creation failed'
              }

              kubectl wait --for=condition=complete job/pactum-migrate `
                -n pactum `
                --timeout=10m

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

              kubectl rollout status deployment/pactum-backend `
                -n pactum `
                --timeout=5m

              if ($LASTEXITCODE -ne 0) {
                throw 'Backend rollout failed'
              }

              kubectl rollout status deployment/pactum-frontend `
                -n pactum `
                --timeout=5m

              if ($LASTEXITCODE -ne 0) {
                throw 'Frontend rollout failed'
              }

              kubectl get ingress,deployments,pods,services,hpa -n pactum
            } finally {
              Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
            }
          '''
        }
      }
    }

    stage('Optional monitoring') {
      when {
        expression {
          return params.DEPLOY_MONITORING
        }
      }

      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'

          .\scripts\helm-docker.ps1 repo add prometheus-community `
            https://prometheus-community.github.io/helm-charts

          if ($LASTEXITCODE -ne 0) {
            throw 'Could not add Prometheus repo'
          }

          .\scripts\helm-docker.ps1 repo update
          if ($LASTEXITCODE -ne 0) {
            throw 'Helm repo update failed'
          }

          .\scripts\helm-docker.ps1 upgrade --install kube-prometheus-stack `
            prometheus-community/kube-prometheus-stack `
            --namespace monitoring `
            --create-namespace `
            --values deploy/kubernetes/monitoring-values.yaml `
            --wait `
            --timeout 15m

          if ($LASTEXITCODE -ne 0) {
            throw 'Monitoring install failed'
          }
        '''
      }
    }
  }

  post {
    success {
      echo "Pactum deployment succeeded for ${env.IMAGE_TAG}"
    }

    failure {
      echo 'Pipeline failed. The previous deployments have not necessarily been changed; inspect the failed stage before retrying.'

      withCredentials([
        usernamePassword(
          credentialsId: 'aws-creds',
          usernameVariable: 'AWS_ACCESS_KEY_ID',
          passwordVariable: 'AWS_SECRET_ACCESS_KEY'
        )
      ]) {
        powershell '''
          $ErrorActionPreference = 'Continue'

          aws eks update-kubeconfig `
            --region $env:AWS_REGION `
            --name $env:CLUSTER_NAME

          if ($LASTEXITCODE -eq 0) {
            kubectl rollout undo deployment/pactum-backend -n pactum
            kubectl rollout undo deployment/pactum-frontend -n pactum
          }

          exit 0
        '''
      }
    }

    always {
      powershell '''
        docker image prune -f

        if ($LASTEXITCODE -ne 0) {
          Write-Host 'Docker prune skipped or failed; ignoring cleanup error.'
        }
      '''
    }
  }
}