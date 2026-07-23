"""小数探客 · 知识宇宙 - 后端服务器
提供注册/登录 API 和静态文件服务
"""
import hashlib
import json
import os
import random
import secrets
import shutil
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------- 配置 ----------
BASE_DIR = Path(__file__).parent
WEB_DIR = BASE_DIR / "web"
DB_PATH = BASE_DIR / "data" / "auth.db"
CONFIG_FILE = BASE_DIR / "data" / "admin_config.json"

# JWT 密钥：优先从环境变量读取，否则每次启动随机生成（生产环境务必设置环境变量）
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72  # 用户登录有效期 3 天

# 管理员密码：优先环境变量，其次配置文件，最后默认值
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
if not ADMIN_PASSWORD and CONFIG_FILE.exists():
    try:
        with open(CONFIG_FILE) as f:
            ADMIN_PASSWORD = json.load(f).get("admin_password", "")
    except Exception:
        pass
if not ADMIN_PASSWORD:
    ADMIN_PASSWORD = "admin123"  # 默认密码，部署后务必修改！

# ---------- 数据库 ----------
os.makedirs(DB_PATH.parent, exist_ok=True)


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            is_used INTEGER NOT NULL DEFAULT 0,
            used_by TEXT,
            used_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            type TEXT NOT NULL DEFAULT 'day',
            duration_days INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            expires_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_codes_code ON verification_codes(code);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    """)
    db.commit()
    db.close()


def migrate_db():
    """迁移旧数据库：添加新字段"""
    db = get_db()
    try:
        # 检查 verification_codes 是否有 type 列
        cols = [r["name"] for r in db.execute("PRAGMA table_info(verification_codes)").fetchall()]
        if "type" not in cols:
            db.execute("ALTER TABLE verification_codes ADD COLUMN type TEXT NOT NULL DEFAULT 'day'")
        if "duration_days" not in cols:
            db.execute("ALTER TABLE verification_codes ADD COLUMN duration_days INTEGER NOT NULL DEFAULT 1")

        # 检查 users 是否有 expires_at 列
        cols = [r["name"] for r in db.execute("PRAGMA table_info(users)").fetchall()]
        if "expires_at" not in cols:
            db.execute("ALTER TABLE users ADD COLUMN expires_at TEXT")
            # 给现有用户设置一个很远的过期时间
            db.execute("UPDATE users SET expires_at = '2099-12-31 23:59:59' WHERE expires_at IS NULL")

        db.commit()
    finally:
        db.close()


init_db()
migrate_db()

# ---------- FastAPI 应用 ----------
app = FastAPI(title="小数探客 API", docs_url=None, redoc_url=None)


# ---------- 工具函数 ----------
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的登录凭证")


def check_membership(user_id: int = None, username: str = None):
    """检查用户会员是否过期，返回 (expires_at, remaining_days)"""
    db = get_db()
    try:
        if user_id:
            user = db.execute("SELECT expires_at FROM users WHERE id = ?", (user_id,)).fetchone()
        elif username:
            user = db.execute("SELECT expires_at FROM users WHERE username = ?", (username,)).fetchone()
        else:
            return None, 0

        if not user or not user["expires_at"]:
            return None, 0

        expires_at = datetime.strptime(user["expires_at"], "%Y-%m-%d %H:%M:%S")
        now = datetime.now()
        remaining = (expires_at - now).days
        if remaining < 0:
            remaining = 0
        return user["expires_at"], max(0, remaining)
    finally:
        db.close()


def require_membership(user_id: int):
    """校验会员资格，过期则拒绝"""
    expires_at, remaining = check_membership(user_id=user_id)
    if remaining <= 0:
        raise HTTPException(status_code=403, detail="会员已过期，请联系管理员续费")
    return expires_at, remaining


# ---------- 请求模型 ----------
class RegisterRequest(BaseModel):
    username: str
    password: str
    code: str  # 4位校验码


class LoginRequest(BaseModel):
    username: str
    password: str


class GenerateCodesRequest(BaseModel):
    count: int = 10
    type: str = "day"  # "day" 或 "year"


class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str


# ---------- API 路由 ----------
@app.post("/api/register")
def register(req: RegisterRequest):
    """注册：用户名 + 密码 + 4位校验码"""
    username = req.username.strip()
    password = req.password.strip()
    code = req.code.strip()

    # 校验参数
    if not username or len(username) < 2 or len(username) > 20:
        raise HTTPException(status_code=400, detail="用户名需 2-20 个字符")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    if not code or len(code) != 4 or not code.isdigit():
        raise HTTPException(status_code=400, detail="校验码为 4 位数字")

    db = get_db()
    try:
        # 检查用户名是否已存在
        existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="该用户名已被注册")

        # 校验验证码
        vc = db.execute(
            "SELECT id, is_used, type, duration_days FROM verification_codes WHERE code = ?", (code,)
        ).fetchone()
        if not vc:
            raise HTTPException(status_code=400, detail="校验码无效")
        if vc["is_used"]:
            raise HTTPException(status_code=400, detail="该校验码已被使用")

        # 计算过期时间
        duration_days = vc["duration_days"]
        now = datetime.now()
        expires_at = (now + timedelta(days=duration_days)).strftime("%Y-%m-%d %H:%M:%S")
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        # 创建用户
        pw_hash = hash_password(password)
        db.execute(
            "INSERT INTO users (username, password_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (username, pw_hash, now_str, expires_at),
        )
        user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

        # 标记校验码为已使用
        db.execute(
            "UPDATE verification_codes SET is_used = 1, used_by = ?, used_at = ? WHERE id = ?",
            (username, now_str, vc["id"]),
        )

        db.commit()

        token = create_token(user_id, username)
        code_type_name = "年卡" if vc["type"] == "year" else "体验卡"
        return {
            "token": token,
            "username": username,
            "message": f"注册成功（{code_type_name}，有效期 {duration_days} 天）",
            "expires_at": expires_at,
            "remaining_days": duration_days,
            "type": vc["type"],
        }
    finally:
        db.close()


@app.post("/api/login")
def login(req: LoginRequest):
    """登录"""
    username = req.username.strip()
    password = req.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="请输入用户名和密码")

    db = get_db()
    try:
        user = db.execute(
            "SELECT id, username, password_hash, expires_at FROM users WHERE username = ?", (username,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="用户名或密码错误")

        if user["password_hash"] != hash_password(password):
            raise HTTPException(status_code=401, detail="用户名或密码错误")

        # 检查会员过期
        if user["expires_at"]:
            expires_dt = datetime.strptime(user["expires_at"], "%Y-%m-%d %H:%M:%S")
            if expires_dt < datetime.now():
                raise HTTPException(status_code=403, detail="会员已过期，请联系管理员续费")

        # 计算剩余天数
        remaining_days = 0
        if user["expires_at"]:
            expires_dt = datetime.strptime(user["expires_at"], "%Y-%m-%d %H:%M:%S")
            remaining_days = max(0, (expires_dt - datetime.now()).days)

        token = create_token(user["id"], user["username"])
        return {
            "token": token,
            "username": user["username"],
            "message": "登录成功",
            "expires_at": user["expires_at"],
            "remaining_days": remaining_days,
        }
    finally:
        db.close()


@app.get("/api/me")
def get_current_user(request: Request):
    """获取当前登录用户信息"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先登录")

    payload = verify_token(auth[7:])

    # 检查会员是否过期
    expires_at, remaining = check_membership(user_id=payload["user_id"])
    if remaining <= 0:
        raise HTTPException(status_code=403, detail="会员已过期，请联系管理员续费")

    return {
        "user_id": payload["user_id"],
        "username": payload["username"],
        "expires_at": expires_at,
        "remaining_days": remaining,
    }


# ---------- 管理员 API ----------
def verify_admin(request: Request):
    """验证管理员密码"""
    pw = request.headers.get("X-Admin-Password", "")
    if pw != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="管理员密码错误")


@app.post("/api/admin/generate-codes")
def admin_generate_codes(req: GenerateCodesRequest, request: Request):
    """管理员生成校验码"""
    verify_admin(request)

    count = max(1, min(req.count, 500))
    code_type = req.type if req.type in ("day", "year") else "day"
    duration_days = 365 if code_type == "year" else 1

    db = get_db()
    try:
        existing = set(
            row["code"] for row in db.execute("SELECT code FROM verification_codes").fetchall()
        )

        new_codes = []
        attempts = 0
        while len(new_codes) < count and attempts < count * 80:
            code = str(random.randint(1000, 9999))
            if code not in existing:
                existing.add(code)
                new_codes.append(code)
            attempts += 1

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for code in new_codes:
            db.execute(
                "INSERT INTO verification_codes (code, type, duration_days, created_at) VALUES (?, ?, ?, ?)",
                (code, code_type, duration_days, now),
            )

        db.commit()
        return {
            "codes": new_codes,
            "count": len(new_codes),
            "type": code_type,
            "duration_days": duration_days,
        }
    finally:
        db.close()


@app.get("/api/admin/codes")
def admin_list_codes(request: Request):
    """管理员查看所有校验码"""
    verify_admin(request)

    db = get_db()
    try:
        rows = db.execute(
            "SELECT code, is_used, type, duration_days, used_by, used_at, created_at FROM verification_codes ORDER BY created_at DESC"
        ).fetchall()

        codes = []
        for r in rows:
            codes.append({
                "code": r["code"],
                "is_used": bool(r["is_used"]),
                "type": r["type"],
                "type_name": "年卡" if r["type"] == "year" else "体验卡",
                "duration_days": r["duration_days"],
                "used_by": r["used_by"],
                "used_at": r["used_at"],
                "created_at": r["created_at"],
            })

        total = len(codes)
        unused = sum(1 for c in codes if not c["is_used"])
        return {"total": total, "unused": unused, "used": total - unused, "codes": codes}
    finally:
        db.close()


@app.get("/api/admin/users")
def admin_list_users(request: Request):
    """管理员查看所有注册用户"""
    verify_admin(request)

    db = get_db()
    try:
        rows = db.execute(
            "SELECT username, created_at, expires_at FROM users ORDER BY created_at DESC"
        ).fetchall()

        now = datetime.now()
        users = []
        for r in rows:
            remaining = 0
            if r["expires_at"]:
                expires_dt = datetime.strptime(r["expires_at"], "%Y-%m-%d %H:%M:%S")
                remaining = max(0, (expires_dt - now).days)

            users.append({
                "username": r["username"],
                "created_at": r["created_at"],
                "expires_at": r["expires_at"],
                "remaining_days": remaining,
                "is_expired": remaining <= 0,
            })
        return {"total": len(users), "users": users}
    finally:
        db.close()


@app.post("/api/admin/reset-password")
def admin_reset_password(req: ResetPasswordRequest, request: Request):
    """管理员重置用户密码"""
    verify_admin(request)

    username = req.username.strip()
    new_password = req.new_password.strip()

    if not username:
        raise HTTPException(status_code=400, detail="请输入用户名")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")

    db = get_db()
    try:
        user = db.execute("SELECT id, username FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        pw_hash = hash_password(new_password)
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user["id"]))
        db.commit()
        return {"message": f"用户「{user['username']}」的密码已重置"}
    finally:
        db.close()


# ---------- 思维导图目录 ----------
MINDMAP_DIR = WEB_DIR / "assets" / "mindmaps"
MINDMAP_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/admin/topics")
def admin_list_topics(request: Request):
    """管理员获取所有知识点列表（用于上传思维导图选择）"""
    verify_admin(request)
    # 直接从 data-cn.js 读取（静态文件，前端注入为 window.CURRICULUM_DATA）
    import re
    data_path = WEB_DIR / "data-cn.js"
    if not data_path.exists():
        return {"topics": []}
    with open(data_path, "r", encoding="utf-8") as f:
        content = f.read()
    # 提取 topics 数组中的 id 和 name
    topics = []
    for m in re.finditer(r'id\s*:\s*"([^"]+)".*?subject\s*:\s*"([^"]+)".*?grade\s*:\s*(\d+).*?name\s*:\s*"([^"]+)"', content):
        topics.append({
            "id": m.group(1),
            "subject": m.group(2),
            "grade": int(m.group(3)),
            "name": m.group(4),
        })
    topics.sort(key=lambda t: (t["grade"], t["subject"], t["name"]))
    return {"topics": topics}


@app.post("/api/admin/upload-mindmap")
async def admin_upload_mindmap(
    request: Request,
    topic_id: str = Form(...),
    file: UploadFile = File(...),
):
    """管理员上传知识点思维导图图片"""
    verify_admin(request)

    # 校验文件类型
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、WebP 格式图片")
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")

    # 保存文件
    save_path = MINDMAP_DIR / f"{topic_id}{ext}"
    # 删除旧文件（可能有不同扩展名）
    for old_ext in (".jpg", ".jpeg", ".png", ".webp"):
        old_path = MINDMAP_DIR / f"{topic_id}{old_ext}"
        if old_path.exists():
            old_path.unlink()

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"message": "上传成功", "path": f"/assets/mindmaps/{topic_id}{ext}"}


@app.get("/api/mindmap/{topic_id}")
def get_mindmap(topic_id: str):
    """检查知识点是否有思维导图"""
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = MINDMAP_DIR / f"{topic_id}{ext}"
        if path.exists():
            return {"exists": True, "path": f"/assets/mindmaps/{topic_id}{ext}"}
    return {"exists": False, "path": None}


# ---------- 静态文件服务 ----------
@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}


# 静态文件挂载（必须在最后）
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="static")


# ---------- 启动入口 ----------
if __name__ == "__main__":
    import uvicorn
    print(f"\n  小数探客 · 知识宇宙  后端服务启动中...")
    print(f"  数据库: {DB_PATH}")
    print(f"  访问地址: http://localhost:8080")
    print(f"  API 文档: http://localhost:8080/api/health\n")
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")