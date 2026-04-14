import os
import uuid
import asyncio
import subprocess
import re
import aiohttp
import platform
from faster_whisper import WhisperModel
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

        await _process_audio_core(task_id, unique_id, audio_ext, audio_path, audio_filename, title, url, upload_dir, database, "下载完成")

    except Exception as e:
        print(f"[AudioURL] Error processing audio: {e}")
        import traceback
        traceback.print_exc()
        audio_tasks[task_id].update({
            "status": "error",
            "error": str(e),
            "stepDescriptions": ["处理失败", str(e), ""]
        })

async def process_uploaded_audio(task_id: str, audio_filename: str, title: str, upload_dir: str, database):
    """
    Background task to transcribe an uploaded audio file
    """
    audio_tasks[task_id] = {
        "status": "processing",
        "title": title or "Processing uploaded audio...",
        "progress": "",
        "stepDescriptions": ["文件处理中", "正在转录音频...", "等待开始..."]
    }

    try:
        audio_path = os.path.join(upload_dir, audio_filename)
        audio_ext = os.path.splitext(audio_filename)[1].lower()
        unique_id = os.path.splitext(audio_filename)[0]

        await _process_audio_core(task_id, unique_id, audio_ext, audio_path, audio_filename, title, "", upload_dir, database, "上传完成")

    except Exception as e:
        print(f"[AudioURL Upload] Error processing audio: {e}")
        import traceback
        traceback.print_exc()
        audio_tasks[task_id].update({
            "status": "error",
            "error": str(e),
            "stepDescriptions": ["处理失败", str(e), ""]
        })

async def _process_audio_core(task_id: str, unique_id: str, audio_ext: str, audio_path: str, audio_filename: str, title: str, source_url: str, upload_dir: str, database, completed_step1_msg: str):
    try:
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
        audio_tasks[task_id]["stepDescriptions"][1] = "正在准备 Whisper 模型..."
        
        loop = asyncio.get_event_loop()
        
        def transcribe_and_build():
            model = WhisperModel("base", compute_type="default")
            # vad_filter removes silence and speeds up processing
            # word_timestamps allows us to rebuild sentences exactly by punctuation
            segments, info = model.transcribe(
                mp3_path, 
                vad_filter=True, 
                vad_parameters=dict(min_silence_duration_ms=500),
                word_timestamps=True
            )
            total_duration = info.duration
            
            content = ""
            count = 0
            
            current_words = []
            current_start = None
            current_end = None
            
            def append_sentence(text, start, end, current_count, current_content):
                text = text.strip()
                text = re.sub(r'\s+', ' ', text)
                if text and not re.search(r'[\u4e00-\u9fa5]', text):
                    current_count += 1
                    current_content += f"{current_count}\n{format_timestamp(start)} --> {format_timestamp(end)}\n{text}\n\n"
                return current_count, current_content

            for i, segment in enumerate(segments):
                if total_duration > 0:
                    progress_percent = int((segment.end / total_duration) * 100)
                    audio_tasks[task_id]["stepDescriptions"][1] = f"正在使用Whisper转录 ({min(progress_percent, 99)}%)..."
                    
                if not segment.words:
                    # Fallback if no word level timestamps are available
                    text = segment.text.strip()
                    count, content = append_sentence(text, segment.start, segment.end, count, content)
                    continue

                for word in segment.words:
                    word_text = word.word.strip()
                    if not word_text:
                        continue
                        
                    if current_start is None:
                        current_start = word.start
                    
                    current_words.append(word.word)
                    current_end = word.end
                    
                    # Check for sentence endings (. ? ! optionally followed by quotes)
                    is_end = bool(re.search(r'[.!?]["\']?$', word_text))
                    
                    # Ignore common abbreviations ending with dot
                    if is_end:
                        lower_word = word_text.lower()
                        if lower_word in ['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'st.', 'vs.', 'etc.']:
                            is_end = False
                            
                    if is_end:
                        text = "".join(current_words)
                        count, content = append_sentence(text, current_start, current_end, count, content)
                        current_words = []
                        current_start = None
                        
            # Flush any remaining words
            if current_words:
                text = "".join(current_words)
                count, content = append_sentence(text, current_start, current_end, count, content)
            
            audio_tasks[task_id]["stepDescriptions"][1] = "正在使用Whisper转录 (100%)..."
            return content, count

        srt_content, segment_count = await loop.run_in_executor(None, transcribe_and_build)

        # 7. Save Subtitle
        subtitle_filename = f"{unique_id}.srt"
        subtitle_path = os.path.join(upload_dir, subtitle_filename)
        with open(subtitle_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)

        audio_tasks[task_id]["stepDescriptions"][2] = "正在保存到数据库..."

        # 8. Save to Database
        video_id = database.create_video(
            title=title,
            video_filename=audio_filename,
            subtitle_filename=subtitle_filename,
            source_url=source_url
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
            "stepDescriptions": [completed_step1_msg, "转录完成", f"成功提取 {segment_count} 条字幕"]
        })
    except Exception as e:
        print(f"[AudioURL Core] Error processing audio: {e}")
        import traceback
        traceback.print_exc()
        audio_tasks[task_id].update({
            "status": "error",
            "error": str(e),
            "stepDescriptions": ["处理失败", str(e), ""]
        })
