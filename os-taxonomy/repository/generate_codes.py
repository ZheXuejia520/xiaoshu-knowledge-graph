"""校验码管理工具
支持两种模式：
  1. 本地模式：直接操作本地 SQLite 数据库（适合开发测试）
  2. 推送模式：生成校验码并推送到远程服务器（适合生产环境）

生产环境推荐使用 Web 管理后台：访问 /admin.html
"""
import json
import os
import random
import sqlite3
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "auth.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
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
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE INDEX IF NOT EXISTS idx_codes_code ON verification_codes(code);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    """)
    db.commit()
    db.close()


def generate_codes(count: int = 10):
    """生成一批校验码并写入本地数据库"""
    db = get_db()

    existing = set(row["code"] for row in db.execute("SELECT code FROM verification_codes").fetchall())

    new_codes = []
    attempts = 0
    while len(new_codes) < count and attempts < count * 50:
        code = str(random.randint(1000, 9999))
        if code not in existing:
            existing.add(code)
            new_codes.append(code)
        attempts += 1

    if len(new_codes) < count:
        print(f"警告：只生成了 {len(new_codes)} 个码（目标 {count}），可能码池已满")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for code in new_codes:
        db.execute(
            "INSERT INTO verification_codes (code, created_at) VALUES (?, ?)",
            (code, now),
        )

    db.commit()
    db.close()

    print(f"\n  ✓ 成功生成 {len(new_codes)} 个校验码：\n")
    for i in range(0, len(new_codes), 5):
        print("    " + "  ".join(new_codes[i:i + 5]))
    print()
    return new_codes


def push_codes(server_url: str, admin_password: str, count: int = 10):
    """通过 API 推送校验码到远程服务器"""
    url = f"{server_url.rstrip('/')}/api/admin/generate-codes"
    data = json.dumps({"count": count}).encode("utf-8")

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Admin-Password", admin_password)

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            codes = result.get("codes", [])
            print(f"\n  ✓ 成功推送 {len(codes)} 个校验码到服务器：\n")
            for i in range(0, len(codes), 5):
                print("    " + "  ".join(codes[i:i + 5]))
            print()
            return codes
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"\n  推送失败: HTTP {e.code} - {body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"\n  连接失败: {e.reason}")
        print(f"  请确认服务器地址正确且已启动")
        sys.exit(1)


def list_codes():
    """列出本地所有校验码及其状态"""
    db = get_db()
    codes = db.execute(
        "SELECT code, is_used, used_by, used_at, created_at FROM verification_codes ORDER BY created_at DESC"
    ).fetchall()
    db.close()

    if not codes:
        print("暂无校验码，请先运行 generate 命令生成。")
        return

    unused = sum(1 for c in codes if not c["is_used"])
    used = sum(1 for c in codes if c["is_used"])
    print(f"\n  校验码总计: {len(codes)}  |  未使用: {unused}  |  已使用: {used}\n")
    print(f"  {'码':<8} {'状态':<8} {'使用者':<14} {'使用时间'}")
    print(f"  {'-'*6}  {'-'*6}  {'-'*12}  {'-'*19}")
    for c in codes:
        status = "已使用" if c["is_used"] else "未使用"
        user = c["used_by"] or "-"
        t = c["used_at"] or "-"
        print(f"  {c['code']:<8} {status:<8} {user:<14} {t}")


def list_users():
    """列出本地所有已注册用户"""
    db = get_db()
    users = db.execute("SELECT username, created_at FROM users ORDER BY created_at DESC").fetchall()
    db.close()

    if not users:
        print("暂无注册用户。")
        return

    print(f"\n  注册用户: {len(users)} 人\n")
    print(f"  {'用户名':<20} {'注册时间'}")
    print(f"  {'-'*18}  {'-'*19}")
    for u in users:
        print(f"  {u['username']:<20} {u['created_at']}")


if __name__ == "__main__":
    os.makedirs(DB_PATH.parent, exist_ok=True)
    init_db()

    if len(sys.argv) < 2:
        print("""
  小数探客 · 校验码管理工具

  === 本地模式（操作本地数据库）===
    python generate_codes.py generate [数量]    生成校验码到本地数据库
    python generate_codes.py list              查看本地校验码状态
    python generate_codes.py users             查看本地注册用户

  === 推送模式（推送到远程服务器）===
    python generate_codes.py push <服务器地址> <管理员密码> [数量]
      示例: python generate_codes.py push http://81.70.19.21:8080 mypassword 20

  提示：生产环境推荐使用 Web 管理后台 → 访问 /admin.html
""")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "generate":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        generate_codes(count)
    elif cmd == "push":
        if len(sys.argv) < 4:
            print("用法: python generate_codes.py push <服务器地址> <管理员密码> [数量]")
            sys.exit(1)
        server_url = sys.argv[2]
        admin_pw = sys.argv[3]
        count = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        push_codes(server_url, admin_pw, count)
    elif cmd == "list":
        list_codes()
    elif cmd == "users":
        list_users()
    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)