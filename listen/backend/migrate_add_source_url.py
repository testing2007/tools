import pymysql

# Windows 配置
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Kuwo1234',
    'database': 'listen_db',
    'charset': 'utf8mb4'
}

conn = pymysql.connect(**DB_CONFIG)
cursor = conn.cursor()

# Check if column exists
cursor.execute("SHOW COLUMNS FROM videos LIKE 'source_url'")
result = cursor.fetchone()

if result:
    print("Column 'source_url' already exists")
else:
    print("Adding 'source_url' column...")
    cursor.execute("ALTER TABLE videos ADD COLUMN source_url VARCHAR(512)")
    conn.commit()
    print("Column added successfully")

conn.close()
print("Migration complete")
