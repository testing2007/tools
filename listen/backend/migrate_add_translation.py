"""
Database Migration - Add translation_filename column to videos table
Run this script to add translation support to the database
"""

import pymysql
from database import get_db_config

def migrate():
    """Add translation_filename column to videos table"""
    DB_CONFIG = get_db_config()
    
    conn = pymysql.connect(
        host=DB_CONFIG['host'],
        port=DB_CONFIG['port'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        database=DB_CONFIG['database'],
        charset=DB_CONFIG['charset']
    )
    
    try:
        with conn.cursor() as cursor:
            # Check if column already exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'videos' 
                AND COLUMN_NAME = 'translation_filename'
            """, (DB_CONFIG['database'],))
            
            exists = cursor.fetchone()[0] > 0
            
            if exists:
                print("[Migration] Column 'translation_filename' already exists, skipping.")
            else:
                cursor.execute("""
                    ALTER TABLE videos 
                    ADD COLUMN translation_filename VARCHAR(255) 
                    AFTER subtitle_filename
                """)
                conn.commit()
                print("[Migration] SUCCESS: Added 'translation_filename' column to videos table")
                
    except Exception as e:
        print(f"[Migration] Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
