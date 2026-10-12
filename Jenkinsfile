pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 60, unit: 'MINUTES')
  }
  parameters {
    string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region')
    string(name: 'STACK_NAME', defaultValue: 'pactum', description: 'CloudFormation stack')
    string(name: 'CLUSTER_NAME', defaultValue: 'pactum-eks', description: 'EKS cluster')
    string(name: 'KUBERNETES_VERSION', defaultValue: '1.33', description: 'EKS Kubernetes version supported in selected region')
    string(name: 'S3_BUCKET_NAME', defaultValue: '', description: 'Globally unique private contracts bucket name')
    string(name: 'ACM_CERTIFICATE_ARN', defaultValue: '', description: 'Optional ACM certificate ARN for HTTPS ALB listener')
    string(name: 'EKS_PUBLIC_ACCESS_CIDRS', defaultValue: '', description: 'Comma-separated CIDR allowlist for EKS API, e.g. 203.0.113.10/32')
    string(name: 'DB_NAME', defaultValue: 'pactum', description: 'RDS database name')
    string(name: 'DB_USERNAME', defaultValue: 'pactumadmin', description: 'RDS master username')
    string(name: 'DB_INSTANCE_CLASS', defaultValue: 'db.t3.micro', description: 'RDS instance class; verify regional availability')
    string(name: 'NODE_INSTANCE_TYPES', defaultValue: 't3.medium', description: 'Comma-separated EC2 types')
    string(name: 'DESIRED_NODES', defaultValue: '2', description: 'Desired EKS worker count')
    string(name: 'MAX_NODES', defaultValue: '3', description: 'Maximum EKS worker count')
    string(name: 'DOCKERHUB_USERNAME', defaultValue: '', description: 'Docker Hub username')
    string(name: 'BACKEND_IMAGE', defaultValue: '', description: 'e.g. username/pactum-backend')
    string(name: 'FRONTEND_IMAGE', defaultValue: '', description: 'e.g. username/pactum-frontend')
    string(name: 'DJANGO_ALLOWED_HOSTS', defaultValue: '*', description: 'Replace * with exact hosts for production')
    string(name: 'CSRF_TRUSTED_ORIGINS', defaultValue: '', description: 'Comma-separated https:// origins')
    string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: '/api', description: 'Public API URL or same-origin path')
    booleanParam(name: 'DEPLOY_MONITORING', defaultValue: false, description: 'Install/upgrade kube-prometheus-stack')
  }
  environment {
    AWS_DEFAULT_REGION = "${params.AWS_REGION}"
    K8S_NAMESPACE = 'pactum'
    IMAGE_TAG = "${env.GIT_COMMIT ?: 'manual'}"
  }
  stages {
    stage('Checkout and validate') {
      steps {
        checkout scm
        sh '''
          set -eu
          command -v aws
          command -v kubectl
          command -v docker
          command -v helm
          test -f backend/manage.py
          test -f frontend/package.json
          aws sts get-caller-identity
          git rev-parse --short=12 HEAD
        '''
        script { env.IMAGE_TAG = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim() }
      }
    }
    stage('Test') {
      parallel {
        stage('Django tests') {
          steps {
            sh '''
              set -eu
              docker build -f backend/Dockerfile --target test -t pactum-backend-test:${IMAGE_TAG} backend
              docker run --rm pactum-backend-test:${IMAGE_TAG}
            '''
          }
        }
        stage('Frontend lint and build') {
          steps {
            dir('frontend') {
              sh '''
                set -eu
                npm ci
                npm run lint --if-present
                npm run build
              '''
            }
          }
        }
      }
    }
    stage('Security scan') {
      steps {
        sh '''
          set -eu
          if ! command -v trivy >/dev/null 2>&1; then
            echo "Trivy not installed on Jenkins agent. Install Trivy or remove this gate intentionally."
            exit 1
          fi
        '''
      }
    }
    stage('Build, scan and push images') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          sh '''
            set -eu
            : "${BACKEND_IMAGE:?Set BACKEND_IMAGE}"
            : "${FRONTEND_IMAGE:?Set FRONTEND_IMAGE}"
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker build --target runtime -t "${BACKEND_IMAGE}:${IMAGE_TAG}" backend
            docker build -t "${FRONTEND_IMAGE}:${IMAGE_TAG}" \
              --build-arg NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" frontend
            trivy image --exit-code 1 --severity HIGH,CRITICAL "${BACKEND_IMAGE}:${IMAGE_TAG}"
            trivy image --exit-code 1 --severity HIGH,CRITICAL "${FRONTEND_IMAGE}:${IMAGE_TAG}"
            docker push "${BACKEND_IMAGE}:${IMAGE_TAG}"
            docker push "${FRONTEND_IMAGE}:${IMAGE_TAG}"
            docker logout
          '''
        }
      }
    }
    stage('Provision infrastructure') {
      steps {
        sh '''
          set -eu
          : "${S3_BUCKET_NAME:?Set S3_BUCKET_NAME}"
          : "${EKS_PUBLIC_ACCESS_CIDRS:?Set EKS_PUBLIC_ACCESS_CIDRS to a restricted CIDR allowlist}"
          aws cloudformation deploy --region "$AWS_REGION" --stack-name "$STACK_NAME" \
            --template-file infra/cloudformation/pactum.yaml \
            --capabilities CAPABILITY_NAMED_IAM \
            --parameter-overrides \
              ClusterName="$CLUSTER_NAME" \
              KubernetesVersion="$KUBERNETES_VERSION" \
              EksPublicAccessCidrs="$EKS_PUBLIC_ACCESS_CIDRS" \
              DbName="$DB_NAME" \
              DbUsername="$DB_USERNAME" \
              DbInstanceClass="$DB_INSTANCE_CLASS" \
              NodeInstanceTypes="$NODE_INSTANCE_TYPES" \
              DesiredNodes="$DESIRED_NODES" \
              MaxNodes="$MAX_NODES" \
              ContractsBucketName="$S3_BUCKET_NAME" \
              AcmCertificateArn="$ACM_CERTIFICATE_ARN" \
            --no-fail-on-empty-changeset
          aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
        '''
      }
    }
    stage('Install cluster add-ons') {
      steps {
        sh '''
          set -eu
          ./scripts/install-addons.sh
        '''
      }
    }
    stage('Deploy Kubernetes resources') {
      steps {
        withCredentials([string(credentialsId: 'pactum-django-secret-key', variable: 'DJANGO_SECRET_KEY')]) {
          sh '''
            set -eu
            export AWS_REGION="$AWS_REGION"
            export STACK_NAME="$STACK_NAME"
            export CLUSTER_NAME="$CLUSTER_NAME"
            export BACKEND_IMAGE="$BACKEND_IMAGE"
            export FRONTEND_IMAGE="$FRONTEND_IMAGE"
            export IMAGE_TAG="$IMAGE_TAG"
            export DJANGO_SECRET_KEY="$DJANGO_SECRET_KEY"
            export DJANGO_ALLOWED_HOSTS="$DJANGO_ALLOWED_HOSTS"
            export CSRF_TRUSTED_ORIGINS="$CSRF_TRUSTED_ORIGINS"
            export NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL"
            export ACM_CERTIFICATE_ARN="$ACM_CERTIFICATE_ARN"
            ./scripts/deploy.sh
          '''
        }
      }
    }
    stage('Optional monitoring') {
      when { expression { return params.DEPLOY_MONITORING } }
      steps {
        sh '''
          set -eu
          helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
          helm repo update
          helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
            --namespace monitoring --create-namespace \
            --values deploy/kubernetes/monitoring-values.yaml \
            --wait --timeout 15m
        '''
      }
    }
  }
  post {
    success { echo "Pactum deployment succeeded for image tag ${env.IMAGE_TAG}" }
    failure {
      echo 'Deployment failed. Attempting application image rollback where prior revisions exist.'
      sh '''
        set +e
        aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
        kubectl rollout undo deployment/pactum-backend -n pactum 2>/dev/null
        kubectl rollout undo deployment/pactum-frontend -n pactum 2>/dev/null
        kubectl rollout status deployment/pactum-backend -n pactum --timeout=180s
        kubectl rollout status deployment/pactum-frontend -n pactum --timeout=180s
        exit 0
      '''
    }
    always { sh 'docker image prune -f || true' }
  }
}
