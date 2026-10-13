
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$HelmArgs
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is required."
}

$kubeDir = Join-Path $env:USERPROFILE ".kube"

if (-not (Test-Path (Join-Path $kubeDir "config"))) {
    throw "Kubeconfig not found at $kubeDir. Run aws eks update-kubeconfig first."
}

$kubeDir = (Resolve-Path $kubeDir).Path -replace '\\', '/'

$dockerArgs = @(
    "run",
    "--rm",
    "-v", "${kubeDir}:/root/.kube",
    "-e", "AWS_ACCESS_KEY_ID",
    "-e", "AWS_SECRET_ACCESS_KEY",
    "-e", "AWS_SESSION_TOKEN",
    "-e", "AWS_DEFAULT_REGION",
    "-e", "AWS_REGION",
    "pactum-helm-aws:latest"
) + $HelmArgs

& docker @dockerArgs

if ($LASTEXITCODE -ne 0) {
    throw "Helm command failed with exit code $LASTEXITCODE"
}
