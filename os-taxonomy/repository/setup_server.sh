#!/bin/bash
# ============================================
#  小数探客 · 知识宇宙  服务器部署脚本
#  在服务器上运行此脚本，完成一键部署
# ============================================
set -e

# ---- 配置（根据实际情况修改）----
PROJECT_DIR="/home/ubuntu/xiaoshutanke"
SERVICE_NAME="xiaoshutanke"
PORT=8080
# 管理员密码（务必修改！）
ADMIN_PASSWORD="${ADMIN_PASSWORD:-xiaoshutanke2026}"
# JWT 密钥（务必修改！）
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

echo "========================================"
echo "  小数探客 · 知识宇宙  服务器部署"
echo "========================================"
echo ""
echo "  项目目录: $PROJECT_DIR"
echo "  服务端口: $PORT"
echo "  服务名称: $SERVICE_NAME"
echo ""

# ---- 1. 检查 Python ----
if ! command -v python3 &>/dev/null; then
    echo "[错误] 未找到 python3，请先安装 Python 3.9+"
    exit 1
fi
echo "[1/5] Python3 已就绪: $(python3 --version)"

# ---- 2. 安装依赖 ----
echo "[2/5] 安装 Python 依赖..."
cd "$PROJECT_DIR"
python3 -m pip install -r requirements.txt -q
echo "      依赖安装完成"

# ---- 3. 创建 systemd 服务 ----
echo "[3/5] 创建 systemd 服务..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=小数探客知识图谱服务
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$PROJECT_DIR
Environment="ADMIN_PASSWORD=$ADMIN_PASSWORD"
Environment="JWT_SECRET=$JWT_SECRET"
ExecStart=python3 server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ---- 4. 启动服务 ----
echo "[4/5] 启动服务..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# ---- 5. 检查状态 ----
echo "[5/5] 检查服务状态..."
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "      服务运行中 ✓"
else
    echo "      [警告] 服务未正常启动，请检查日志:"
    echo "      sudo journalctl -u ${SERVICE_NAME} -n 30"
fi

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "  访问地址: http://$(hostname -I | awk '{print $1}'):${PORT}"
echo "  管理后台: http://$(hostname -I | awk '{print $1}'):${PORT}/admin.html"
echo "  管理员密码: $ADMIN_PASSWORD"
echo ""
echo "  常用命令:"
echo "    sudo systemctl status ${SERVICE_NAME}   # 查看状态"
echo "    sudo systemctl restart ${SERVICE_NAME}  # 重启服务"
echo "    sudo journalctl -u ${SERVICE_NAME} -f   # 查看日志"
echo ""
echo "  修改密码后重启:"
echo "    编辑 /etc/systemd/system/${SERVICE_NAME}.service"
echo "    修改 ADMIN_PASSWORD 的值"
echo "    sudo systemctl daemon-reload"
echo "    sudo systemctl restart ${SERVICE_NAME}"
echo ""