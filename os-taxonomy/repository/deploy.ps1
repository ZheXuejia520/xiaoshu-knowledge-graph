# ============================================
#  小数探客 · 知识宇宙  上传部署脚本 (Windows)
#  在本地 PowerShell 中运行，自动上传文件到服务器
# ============================================

param(
    [string]$Server = "81.70.19.21",
    [string]$User = "ubuntu",
    [string]$RemotePath = "/home/ubuntu/xiaoshutanke"
)

$ErrorActionPreference = "Stop"
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  小数探客 · 知识宇宙  上传部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  服务器: ${User}@${Server}" -ForegroundColor Yellow
Write-Host "  远程目录: ${RemotePath}" -ForegroundColor Yellow
Write-Host ""

# ---- 需要上传的文件列表 ----
$filesToUpload = @(
    "server.py",
    "requirements.txt",
    "generate_codes.py",
    "setup_server.sh",
    "web\index.html",
    "web\login.html",
    "web\admin.html",
    "web\app.js",
    "web\data-cn.js",
    "web\styles.css",
    "web\assets\cosmic-background.webp",
    "data\clusters.json",
    "data\curriculum-standards.json",
    "data\dependencies.json",
    "data\manifest.json",
    "data\topics.json"
)

# ---- 在服务器上创建目录结构 ----
Write-Host "[1/3] 创建远程目录结构..." -ForegroundColor Green
$dirs = @(
    "$RemotePath",
    "$RemotePath/web",
    "$RemotePath/web/assets",
    "$RemotePath/data"
)
foreach ($dir in $dirs) {
    ssh "${User}@${Server}" "mkdir -p $dir"
}

# ---- 上传文件 ----
Write-Host "[2/3] 上传文件..." -ForegroundColor Green
foreach ($file in $filesToUpload) {
    $localPath = Join-Path $repoDir $file
    $remoteFile = "$RemotePath/$($file -replace '\\', '/')"
    
    if (Test-Path $localPath) {
        Write-Host "  上传: $file" -ForegroundColor Gray
        scp $localPath "${User}@${Server}:$remoteFile"
    } else {
        Write-Host "  [跳过] 文件不存在: $file" -ForegroundColor DarkYellow
    }
}

# ---- 在服务器上运行部署脚本 ----
Write-Host "[3/3] 在服务器上运行部署脚本..." -ForegroundColor Green
ssh "${User}@${Server}" "cd $RemotePath && chmod +x setup_server.sh && bash setup_server.sh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan