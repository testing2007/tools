import os
import platform
import pymysql
from contextlib import contextmanager

# =============================================
# MySQL Configuration - Multi-Environment
# =============================================

# Windows 配置
WINDOWS_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Kuwo1234',  # Windows MySQL 密码
    'database': 'listen_db',
    'charset': 'utf8mb4'
}

# Linux (CentOS) 配置
LINUX_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Kuwo1234@',  # Linux MySQL 密码
    'database': 'listen_db',
    'charset': 'utf8mb4'
}

# 自动检测操作系统
def get_db_config():
    system = platform.system().lower()
    if system == 'windows':
        print(f"[Database] Using Windows config")
        return WINDOWS_CONFIG
    else:
        print(f"[Database] Using Linux config")
        return LINUX_CONFIG

DB_CONFIG = get_db_config()

# =============================================
# Database Functions
# =============================================

def init_database():
    """Create database and table if not exists"""
    conn = pymysql.connect(
        host=DB_CONFIG['host'],
        port=DB_CONFIG['port'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        charset=DB_CONFIG['charset']
    )
    
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
            cursor.execute(f"USE {DB_CONFIG['database']}")
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS videos (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(255) NOT NULL,
                    video_filename VARCHAR(255) NOT NULL,
                    subtitle_filename VARCHAR(255),
                    source_url VARCHAR(512),
                    duration INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_source_url (source_url(255))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            print("[Database] Initialized successfully")
    finally:
        conn.close()

@contextmanager
def get_db_connection():
    """Get database connection context manager"""
    conn = pymysql.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()

def get_videos():
    """Get all videos"""
    with get_db_connection() as conn:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT id, title, video_filename, subtitle_filename, translation_filename, duration, created_at 
                FROM videos ORDER BY created_at DESC
            """)
            return cursor.fetchall()

def get_video(video_id: int):
    """Get single video by id"""
    with get_db_connection() as conn:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT id, title, video_filename, subtitle_filename, translation_filename, duration, created_at 
                FROM videos WHERE id = %s
            """, (video_id,))
            return cursor.fetchone()

def create_video(title: str, video_filename: str, subtitle_filename: str = None, duration: int = 0, source_url: str = None):
    """Create new video record"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO videos (title, video_filename, subtitle_filename, duration, source_url)
                VALUES (%s, %s, %s, %s, %s)
            """, (title, video_filename, subtitle_filename, duration, source_url))
            conn.commit()
            return cursor.lastrowid

def get_video_by_source_url(source_url: str):
    """Get video by source URL to check for duplicates"""
    with get_db_connection() as conn:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT id, title, video_filename, subtitle_filename, translation_filename, source_url, duration, created_at 
                FROM videos WHERE source_url = %s
            """, (source_url,))
            return cursor.fetchone()

def delete_video(video_id: int):
    """Delete video record"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM videos WHERE id = %s", (video_id,))
            conn.commit()
            return cursor.rowcount > 0

def update_video_translation(video_id: int, translation_filename: str):
    """Update translation_filename for a video"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE videos 
                SET translation_filename = %s 
                WHERE id = %s
            """, (translation_filename, video_id))
            conn.commit()
            return cursor.rowcount > 0

if __name__ == "__main__":
    init_database()
