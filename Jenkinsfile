pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
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
                    $required = @(
                        "backend/Dockerfile",
                        "backend/requirements.txt",
                        "frontend/Dockerfile",
                        "frontend/package.json"
                    )

                    foreach ($file in $required) {
                        if (-not (Test-Path $file)) {
                            throw "Required file not found: $file"
                        }
                    }

                    docker info | Out-Host
                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker engine is unavailable."
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
                        $ErrorActionPreference = "Stop"
                        $user = $env:DOCKERHUB_USER.Trim()
                        $password = $env:DOCKERHUB_PASS.Trim()

                        if ([string]::IsNullOrWhiteSpace($user) -or
                            [string]::IsNullOrWhiteSpace($password)) {
                            throw "Docker Hub credentials are empty."
                        }

                        $passwordFile = Join-Path $env:TEMP ("docker-pass-" + [guid]::NewGuid().ToString() + ".txt")

                        try {
                            [System.IO.File]::WriteAllText(
                                $passwordFile,
                                $password,
                                [System.Text.UTF8Encoding]::new($false)
                            )

                            cmd /c "docker login -u $user --password-stdin < `"$passwordFile`""
                            if ($LASTEXITCODE -ne 0) {
                                throw "Docker Hub login failed."
                            }
                        }
                        finally {
                            if (Test-Path $passwordFile) {
                                Remove-Item $passwordFile -Force
                            }
                        }

                        $backendImage = "$user/pactum-backend:$env:IMAGE_TAG"
                        $frontendImage = "$user/pactum-frontend:$env:IMAGE_TAG"

                        Write-Host "Building backend: $backendImage"
                        docker build -f backend/Dockerfile -t $backendImage backend
                        if ($LASTEXITCODE -ne 0) {
                            throw "Backend Docker build failed."
                        }

                        Write-Host "Building frontend: $frontendImage"
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

                        Write-Host "Images successfully pushed:"
                        Write-Host $backendImage
                        Write-Host $frontendImage
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Step 1 complete: both images were built and pushed to Docker Hub.'
        }
        failure {
            echo 'Step 1 failed. Fix this stage before adding AWS deployment.'
        }
        always {
            powershell '''
                docker image prune -f
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "Docker image cleanup failed; continuing."
                }
            '''
        }
    }
}
