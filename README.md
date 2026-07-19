# 小数探客 · 知识宇宙

中国小学一至六年级交互式课程知识图谱，以 3D 星系视角呈现知识点之间的前置依赖与学习路径。

> 在线访问：[https://tupu.小数探客.club](https://tupu.小数探客.club)

---

## 功能概览

- **3D 知识星系** — 每个知识点是一颗星球，颜色代表学科，高度代表年级，连线表示学习依赖关系
- **知识点详情五菜单** — 基础标签、图谱逻辑链路、核心目标、知识内容、知识练习（五步法）
- **搜索与筛选** — 按年级、学科筛选，支持知识点名称搜索，搜索结果高亮闪烁
- **学习路径追踪** — 点击节点展示前置/后续依赖，实线=必修、虚线=建议关联，连线带动画
- **分级会员系统** — 体验卡（1天）和年卡（365天），过期自动拦截
- **管理后台** — 生成校验码、查看用户列表、管理会员有效期
- **移动端适配** — 底部拖拽把手交互，搜索栏优化，触摸手势支持
- **彩蛋** — 搜索"小鱼"触发 Canvas 动画金鱼

## 知识点覆盖

| 学科 | 年级 | 知识点数 |
|------|------|----------|
| 数学 | 1-6年级 | 109 |
| 语文 | 1-6年级 | 18 |
| 英语 | 3-6年级 | 5 |
| 科学 | 3-6年级 | 4 |
| **合计** | | **136** |

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3, FastAPI, SQLite, PyJWT |
| 前端 | Vanilla JS, Canvas 2D, CSS3 (Glassmorphism) |
| 部署 | systemd, Nginx 反向代理, Let's Encrypt SSL |

## 项目结构

```
├── server.py              # FastAPI 后端（注册/登录/校验码/静态文件）
├── requirements.txt       # Python 依赖
├── generate_codes.py      # 校验码生成工具
├── setup_server.sh        # 服务器一键部署脚本
├── deploy.ps1             # Windows 初次部署（SCP 上传）
├── update.ps1             # Windows 增量更新（仅同步变更文件）
├── web/
│   ├── index.html         # 主页面（知识图谱）
│   ├── login.html         # 登录/注册页
│   ├── admin.html         # 管理后台
│   ├── app.js             # 核心前端逻辑（3D 渲染、交互）
│   ├── data-cn.js         # 136 个知识点数据
│   ├── styles.css         # 全局样式
│   └── assets/            # 静态资源
└── data/
    ├── auth.db            # 用户 & 校验码数据库
    ├── topics.json        # 原始知识点数据（英文版）
    ├── dependencies.json  # 原始依赖关系
    ├── clusters.json      # 领域聚合摘要
    └── manifest.json      # 数据清单
```

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python server.py

# 3. 浏览器访问
# http://localhost:8080
```

### 生成校验码

```bash
# 生成年卡校验码（365天）
python generate_codes.py --type year --count 10

# 生成体验卡校验码（1天）
python generate_codes.py --type day --count 20
```

### 服务器部署

```bash
# 一键部署
bash setup_server.sh
```

## 管理员

- 管理后台：`/admin.html`
- 默认密码：部署后务必修改 `ADMIN_PASSWORD` 环境变量
- 功能：生成校验码、查看用户列表、查看会员有效期

## 会员体系

| 类型 | 有效期 | 价格 |
|------|--------|------|
| 体验卡 | 1天 | 9.9元 |
| 年卡 | 365天 | 99元 |

> 交易在线下完成，管理员在后台生成校验码后发放给用户。

## 许可

本项目基于 [Marble Skill Taxonomy](https://github.com/withmarble/os-taxonomy) 数据集二次开发，原始数据采用 ODbL 1.0 (数据库) + CC BY-SA 4.0 (内容) 双许可。

前端可视化与后端服务代码为自主开发。