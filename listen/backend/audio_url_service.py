import os
import uuid
import asyncio
import subprocess
import re
import aiohttp
import platform
import whisper
from typing import Dict, Any

# Nginx static folder for serving files (Windows local dev)
NGINX_UPLOADS_DIR = None
if platform.system().lower() == 'windows':
    NGINX_UPLOADS_DIR = r"F:\client\dbsass\tools\listen\uploads"

# Task storage for progress tracking
audio_tasks = {}

def get_task_status(task_id: str):
    return audio_tasks.get(task_id, {"status": "not_found"})

def format_timestamp(seconds: float) -> str:
    td = float(seconds)
    hours = int(td // 3600)
    minutes = int((td % 3600) // 60)
    secs = int(td % 60)
    millis = int((td % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

async def download_audio_file(url: str, save_path: str, task_id: str) -> bool:
    """Download audio file from URL with progress tracking"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"HTTP Error: {response.status}")
                
                # Get content length for progress
                total_size = int(response.headers.get('content-length', 0))
                downloaded = 0
                
                with open(save_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = int((downloaded / total_size) * 100)
                            audio_tasks[task_id]["stepDescriptions"][0] = f"下载中... {progress}%"
                
                return True
    except Exception as e:
        print(f"[AudioURL] Download error: {e}")
        return False

async def process_audio_url(task_id: str, url: str, title: str, upload_dir: str, database):
    """
    Background task to download audio from URL and transcribe
    """
    audio_tasks[task_id] = {
        "status": "processing",
        "title": title or "Processing audio...",
        "progress": "",
        "stepDescriptions": ["准备下载音频...", "等待开始...", "等待开始..."]
    }

    try:
        # 1. Check for duplicate URL
        existing_video = database.get_video_by_source_url(url)
        if existing_video:
            audio_tasks[task_id].update({
                "status": "completed",
                "title": existing_video['title'],
                "video_id": existing_video['id'],
                "stepDescriptions": ["音频已存在", "跳过下载", "直接使用现有字幕"]
            })
            return

        # 2. Generate unique filenames
        unique_id = uuid.uuid4().hex
        
        # Determine audio extension from URL
        audio_ext = '.mp3'
        if '.m4a' in url.lower():
            audio_ext = '.m4a'
        elif '.wav' in url.lower():
            audio_ext = '.wav'
        elif '.ogg' in url.lower():
            audio_ext = '.ogg'
        elif '.aac' in url.lower():
            audio_ext = '.aac'
        
        audio_filename = f"{unique_id}{audio_ext}"
        audio_path = os.path.join(upload_dir, audio_filename)
        
        # 3. Download audio file
        audio_tasks[task_id]["stepDescriptions"][0] = "正在下载音频..."
        
        success = await download_audio_file(url, audio_path, task_id)
        if not success:
            raise Exception("Failed to download audio file")
        
        if not title:
            # Try to extract title from URL
            title = url.split('/')[-1].split('?')[0]
            if '.' in title:
                title = title.rsplit('.', 1)[0]
            title = title or "Podcast Audio"
        
        audio_tasks[task_id].update({
            "title": title,
            "stepDescriptions": ["下载完成", "正在转录音频...", "等待开始..."]
        })

        # 4. Convert to MP3 if needed (for Whisper compatibility)
        mp3_path = audio_path
        if audio_ext != '.mp3':
            mp3_path = os.path.join(upload_dir, f"{unique_id}_converted.mp3")
            cmd = [
                'ffmpeg', '-y', '-i', audio_path,
                '-acodec', 'libmp3lame', '-q:a', '4',
                mp3_path
            ]
            ffmpeg_proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            await ffmpeg_proc.communicate()
            
            if not os.path.exists(mp3_path):
                # Use original if conversion failed
                mp3_path = audio_path

        # 5. Whisper Transcription
        audio_tasks[task_id]["stepDescriptions"][1] = "正在使用Whisper转录..."
        
        loop = asyncio.get_event_loop()
        
        def transcribe():
            model = whisper.load_model("base")
            return model.transcribe(mp3_path)

        result = await loop.run_in_executor(None, transcribe)
        
        # 6. Filter and Generate SRT
        srt_content = ""
        segment_count = 0
        for i, segment in enumerate(result.get('segments', [])):
            start = format_timestamp(segment['start'])
            end = format_timestamp(segment['end'])
            text = segment['text'].strip()
            
            # Filter Chinese - only allow English/ASCII
            if text and not re.search(r'[\u4e00-\u9fa5]', text):
                segment_count += 1
                srt_content += f"{segment_count}\n{start} --> {end}\n{text}\n\n"

        # 7. Save Subtitle
        subtitle_filename = f"{unique_id}.srt"
        subtitle_path = os.path.join(upload_dir, subtitle_filename)
        with open(subtitle_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)

        audio_tasks[task_id]["stepDescriptions"][2] = "正在保存到数据库..."

        # 8. Save to Database
        # For audio-only, we use the audio file as "video_filename"
        video_id = database.create_video(
            title=title,
            video_filename=audio_filename,
            subtitle_filename=subtitle_filename,
            source_url=url
        )

        # 9. Copy to nginx folder if configured (Windows only)
        if NGINX_UPLOADS_DIR and os.path.exists(NGINX_UPLOADS_DIR):
            import shutil
            try:
                shutil.copy2(audio_path, os.path.join(NGINX_UPLOADS_DIR, audio_filename))
                shutil.copy2(subtitle_path, os.path.join(NGINX_UPLOADS_DIR, subtitle_filename))
                # Remove from backend uploads after copying
                os.remove(audio_path)
                os.remove(subtitle_path)
            except Exception as e:
                print(f"[AudioURL] Warning: Failed to copy to nginx folder: {e}")

        # 10. Cleanup temporary files
        if audio_ext != '.mp3' and os.path.exists(mp3_path) and mp3_path != audio_path:
            try:
                os.remove(mp3_path)
            except:
                pass

        audio_tasks[task_id].update({
            "status": "completed",
            "video_id": video_id,
            "stepDescriptions": ["下载完成", "转录完成", f"成功提取 {segment_count} 条字幕"]
        })

    except Exception as e:
        print(f"[AudioURL] Error processing audio: {e}")
        import traceback
        traceback.print_exc()
        audio_tasks[task_id].update({
            "status": "error",
            "error": str(e),
            "stepDescriptions": ["处理失败", str(e), ""]
        })
