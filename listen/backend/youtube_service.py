import os
import uuid
import shutil
import platform
import yt_dlp
import whisper
import subprocess
import re
import asyncio
from typing import Dict, Any, Optional

# Nginx static folder for serving files (Windows local dev)
# This should be configured based on environment
NGINX_UPLOADS_DIR = None
if platform.system().lower() == 'windows':
    NGINX_UPLOADS_DIR = r"F:\client\dbsass\tools\listen\uploads"

# Task storage for progress tracking
tasks = {}

def get_task_status(task_id: str):
    return tasks.get(task_id, {"status": "not_found"})

def format_timestamp(seconds: float) -> str:
    td = float(seconds)
    hours = int(td // 3600)
    minutes = int((td % 3600) // 60)
    secs = int(td % 60)
    millis = int((td % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

async def process_youtube_video(task_id: str, url: str, upload_dir: str, database):
    """
    Background task to download video and transcribe audio
    """
    tasks[task_id] = {
        "status": "processing",
        "title": "Analyzing video...",
        "progress": "",
        "stepDescriptions": ["正在分析视频元数据...", "等待开始...", "等待开始..."]
    }

    try:
        # 1. Clean URL (remove playlist args if any, just to be safe)
        original_url = url
        if "list=" in url:
            url = url.split("&list=")[0]
        
        # 1.1 Check for duplicate URL
        existing_video = database.get_video_by_source_url(url)
        if existing_video:
            tasks[task_id].update({
                "status": "completed",
                "title": existing_video['title'],
                "video_id": existing_video['id'],
                "stepDescriptions": ["视频已存在", "跳过下载", "直接使用现有字幕"]
            })
            return
            
        # 1. Get info and Download
        # Ensure filenames are safe and unique
        unique_id = uuid.uuid4().hex
        video_filename = f"{unique_id}.mp4"
        video_path = os.path.join(upload_dir, video_filename)
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best',
            'outtmpl': video_path,
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'nocheckcertificate': True,
            'retries': 10,
            'fragment_retries': 10,
            'file_access_retries': 5,
            'extractor_retries': 5,
            'socket_timeout': 30,
            'merge_output_format': 'mp4',
            'postprocessor_args': {
                'merger': ['-movflags', '+faststart'],
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.youtube.com/',
            },
            # v2rayN proxy - default HTTP proxy port is 10809
            'proxy': 'http://127.0.0.1:10809',
            'geo_bypass': True,
            'geo_bypass_country': 'US',
            # Enable Node.js runtime for YouTube's JavaScript challenges
            'js_runtimes': {'node': {}},
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'android', 'web'],
                }
            },
        }

        loop = asyncio.get_event_loop()
        
        def download():
            import subprocess
            import json
            
            # Set proxy environment variables
            env = os.environ.copy()
            env['HTTP_PROXY'] = 'http://127.0.0.1:10809'
            env['HTTPS_PROXY'] = 'http://127.0.0.1:10809'
            env['ALL_PROXY'] = 'http://127.0.0.1:10809'
            
            # Build yt-dlp command
            # Proxy is optional - set YOUTUBE_PROXY env var if needed (e.g., socks5://127.0.0.1:10808)
            proxy = os.environ.get('YOUTUBE_PROXY', '')
            
            cmd = [
                'yt-dlp',
                '--js-runtimes', 'node',  # Use Node.js for YouTube JavaScript challenges
                '-f', 'best',  # Use best available format
                '--merge-output-format', 'mp4',
                '--no-playlist',
                '-o', video_path,
                '--print-json',
                url
            ]
            
            # Add proxy if configured (insert right after 'yt-dlp')
            if proxy:
                cmd.insert(1, '--proxy')
                cmd.insert(2, proxy)
            
            print(f"[YouTube] Running command: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, env=env)
            
            if result.returncode != 0:
                print(f"[YouTube] Error: {result.stderr}")
                raise Exception(f"yt-dlp failed: {result.stderr}")
            
            # Parse the JSON output (last line)
            output_lines = result.stdout.strip().split('\n')
            json_line = output_lines[-1]
            info = json.loads(json_line)
            return info

        # This will download the file to video_path
        info = await loop.run_in_executor(None, download)
        
        tasks[task_id].update({
            "title": info.get('title', 'YouTube Video'),
            "status": "downloading",
            "stepDescriptions": ["解析成功", "正在下载视频 (已完成)", "等待开始转录..."]
        })

        # 2. Extract Audio for Whisper
        tasks[task_id]["status"] = "transcribing"
        tasks[task_id]["stepDescriptions"][2] = "正在提取音频并进行 AI 转录..."
        
        audio_path = os.path.join(upload_dir, f"{unique_id}.mp3")
        
        # ffmpeg command to extract audio
        cmd = [
            'ffmpeg', '-y', '-i', video_path, 
            '-vn', '-acodec', 'libmp3lame', '-q:a', '4', 
            audio_path
        ]
        
        ffmpeg_proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        await ffmpeg_proc.communicate()

        if not os.path.exists(audio_path):
            raise Exception("Failed to extract audio from video")

        # 3. Whisper Transcription
        def transcribe():
            # Use 'base' model for decent speed/accuracy on CPU
            model = whisper.load_model("base")
            return model.transcribe(audio_path)

        result = await loop.run_in_executor(None, transcribe)
        
        # 4. Filter and Generate SRT
        srt_content = ""
        segment_count = 0
        for i, segment in enumerate(result.get('segments', [])):
            start = format_timestamp(segment['start'])
            end = format_timestamp(segment['end'])
            text = segment['text'].strip()
            
            # Filter Chinese - only allow English/ASCII (and common punctuation)
            # Rule: if text contains Chinese characters, skip it
            if text and not re.search(r'[\u4e00-\u9fa5]', text):
                segment_count += 1
                srt_content += f"{segment_count}\n{start} --> {end}\n{text}\n\n"

        # 5. Save Subtitle
        subtitle_filename = f"{unique_id}.srt"
        subtitle_path = os.path.join(upload_dir, subtitle_filename)
        with open(subtitle_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        # 6. Database and Cleanup
        video_id = database.create_video(
            title=tasks[task_id]["title"],
            video_filename=video_filename,
            subtitle_filename=subtitle_filename,
            source_url=url
        )
        
        # Clean up temp audio file
        if os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except:
                pass

        tasks[task_id].update({
            "status": "completed",
            "video_id": video_id,
            "stepDescriptions": ["解析成功", "下载完成", f"转录完成 (生成 {segment_count} 条字幕)"]
        })
        
        # 7. Sync to Nginx folder (Windows only) and cleanup temp files
        if NGINX_UPLOADS_DIR and os.path.exists(NGINX_UPLOADS_DIR):
            try:
                # Copy video and subtitle to nginx folder
                nginx_video_path = os.path.join(NGINX_UPLOADS_DIR, video_filename)
                nginx_subtitle_path = os.path.join(NGINX_UPLOADS_DIR, subtitle_filename)
                
                shutil.copy2(video_path, nginx_video_path)
                shutil.copy2(subtitle_path, nginx_subtitle_path)
                print(f"[Sync] Copied files to nginx folder: {NGINX_UPLOADS_DIR}")
                
                # Delete temp files after successful copy
                try:
                    os.remove(video_path)
                    os.remove(subtitle_path)
                    print(f"[Cleanup] Removed temp files from: {upload_dir}")
                except Exception as cleanup_error:
                    print(f"[Cleanup] Warning: Failed to remove temp files: {cleanup_error}")
            except Exception as sync_error:
                print(f"[Sync] Warning: Failed to sync files: {sync_error}")
        
        # 8. Cleanup audio temp file (always, even if no nginx copy)
        if os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                print(f"[Cleanup] Removed audio temp file: {audio_path}")
            except Exception as cleanup_error:
                print(f"[Cleanup] Warning: Failed to remove audio file: {cleanup_error}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        tasks[task_id].update({
            "status": "failed",
            "error": str(e)
        })
