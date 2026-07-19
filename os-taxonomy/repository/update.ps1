# ============================================
#  小数探客 · 快速更新脚本 (Windows)
#  修改代码后运行此脚本，秒级更新到服务器
# ============================================

param(
    [string]$Server = "81.70.19.21",
    [string]$User = "ubuntu",
    [string]$RemotePath = "/home/ubuntu/xiaoshutanke"
)

$ErrorActionPreference = "Stop"
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  小数探客 · 快速更新" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  服务器: ${User}@${Server}" -ForegroundColor Yellow
Write-Host ""

# ---- 需要同步的文件（增量更新） ----
$syncFiles = @(
    # 前端文件（改动最频繁）
    "web\index.html",
    "web\login.html",
    "web\admin.html",
    "web\app.js",
    "web\data-cn.js",
    "web\styles.css",
    "web\assets\cosmic-background.webp",
    # 后端
    "server.py",
    "generate_codes.py",
    # 数据（偶尔改动）
    "data\clusters.json",
    "data\curriculum-standards.json",
    "data\dependencies.json",
    "data\manifest.json",
    "data\topics.json",
    # 依赖（极少改动）
    "requirements.txt"
)

# ---- 上传变更的文件 ----
Write-Host "[1/2] 上传变更文件..." -ForegroundColor Green
$uploaded = 0
foreach ($file in $syncFiles) {
    $localPath = Join-Path $repoDir $file
    $remoteFile = "$RemotePath/$($file -replace '\\', '/')"
    
    if (-not (Test-Path $localPath)) {
        Write-Host "  [跳过] 文件不存在: $file" -ForegroundColor DarkYellow
        continue
    }
    
    Write-Host "  上传: $file" -ForegroundColor Gray
    scp -q $localPath "${User}@${Server}:$remoteFile"
    $uploaded++
}

Write-Host "  共上传 $uploaded 个文件" -ForegroundColor Green

# ---- 重启服务 ----
Write-Host "[2/2] 重启服务..." -ForegroundColor Green
ssh "${User}@${Server}" "sudo systemctl restart xiaoshutanke"

# ---- 验证 ----
Start-Sleep -Seconds 2
$status = ssh "${User}@${Server}" "systemctl is-active xiaoshutanke"
if ($status -match "active") {
    Write-Host "  服务运行正常 ✓" -ForegroundColor Green
} else {
    Write-Host "  [警告] 服务可能未正常启动，请检查" -ForegroundColor Red
    Write-Host "  ssh ${User}@${Server} 'sudo journalctl -u xiaoshutanke -n 20'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  更新完成！刷新浏览器即可看到最新效果" -ForegroundColor Cyan