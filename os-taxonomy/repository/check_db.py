import sqlite3

conn = sqlite3.connect('data/auth.db')
c = conn.cursor()

# schema
print("=== Schema ===")
for row in c.execute("PRAGMA table_info(users)"):
    print(row)

print()
print("=== Users ===")
for row in c.execute("SELECT * FROM users"):
    print(row)

print()
print("=== Verification Codes (last 20) ===")
for row in c.execute("SELECT * FROM verification_codes ORDER BY rowid DESC LIMIT 20"):
    print(row)

conn.close()