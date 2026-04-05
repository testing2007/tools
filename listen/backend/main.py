"""
Listen App - Video Library API
FastAPI backend for video + subtitle storage
"""

import os
import uuid
import platform
import aiofiles
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional, List
from pydantic import BaseModel

import database
import youtube_service

# Config - temp_media is in project root (outside backend folder) for cleaner deployment
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_media")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Nginx static folder (Windows only) - files are synced here and deleted from UPLOAD_DIR
NGINX_UPLOADS_DIR = None
if platform.system().lower() == 'windows':
    NGINX_UPLOADS_DIR = r"F:\client\dbsass\tools\listen\uploads"

# Initialize FastAPI
app = FastAPI(title="Listen API", version="1.0.0")

# CORS - Allow all origins for simplicity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note: Using custom endpoint for /uploads to support fallback to nginx folder
# app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup():
    """Initialize database on startup"""
    try:
        database.init_database()
    except Exception as e:
        print(f"Database init warning: {e}")


@app.get("/uploads/{filename:path}")
async def serve_upload(filename: str, request: Request):
    """Serve uploaded files with Range request support for video seeking"""
    from starlette.responses import StreamingResponse
    import mimetypes
    
    # Try UPLOAD_DIR first
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Fallback to nginx folder if not found
    if not os.path.exists(file_path) and NGINX_UPLOADS_DIR:
        file_path = os.path.join(NGINX_UPLOADS_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    file_size = os.path.getsize(file_path)
    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"
    
    # Parse Range header
    range_header = request.headers.get("range")
    
    if range_header:
        # Parse range like "bytes=0-1023"
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Ensure valid range
        if start >= file_size:
            raise HTTPException(status_code=416, detail="Range not satisfiable")
        end = min(end, file_size - 1)
        chunk_size = end - start + 1
        
        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(8192, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": content_type,
        }
        return StreamingResponse(iter_file(), status_code=206, headers=headers, media_type=content_type)
    
    # No Range header - return full file
    return FileResponse(file_path, media_type=content_type, headers={"Accept-Ranges": "bytes"})


@app.get("/")
async def root():
    return {"message": "Listen API is running"}


@app.get("/videos")
async def list_videos():
    """Get all videos"""
    try:
        videos = database.get_videos()
        # Convert datetime to string for JSON
        for v in videos:
            if v['created_at']:
                v['created_at'] = v['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        return {"videos": videos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/videos/{video_id}")
async def get_video(video_id: int):
    """Get single video details"""
    video = database.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video['created_at']:
        video['created_at'] = video['created_at'].strftime('%Y-%m-%d %H:%M:%S')
    
    # Read subtitle content if exists (check both UPLOAD_DIR and NGINX_UPLOADS_DIR)
    subtitle_content = None
    if video['subtitle_filename']:
        # Try UPLOAD_DIR first
        subtitle_path = os.path.join(UPLOAD_DIR, video['subtitle_filename'])
        # Fallback to nginx folder if not found in UPLOAD_DIR
        if not os.path.exists(subtitle_path) and NGINX_UPLOADS_DIR:
            subtitle_path = os.path.join(NGINX_UPLOADS_DIR, video['subtitle_filename'])
        
        if os.path.exists(subtitle_path):
            async with aiofiles.open(subtitle_path, 'r', encoding='utf-8') as f:
                subtitle_content = await f.read()
    
    video['subtitle_content'] = subtitle_content
    return video


@app.post("/videos/upload")
async def upload_video(
    title: str = Form(...),
    video: UploadFile = File(...),
    subtitle: Optional[UploadFile] = File(None)
):
    """Upload video and optional subtitle file"""
    
    # Generate unique filenames
    video_ext = os.path.splitext(video.filename)[1]
    video_filename = f"{uuid.uuid4().hex}{video_ext}"
    
    subtitle_filename = None
    if subtitle:
        subtitle_ext = os.path.splitext(subtitle.filename)[1]
        subtitle_filename = f"{uuid.uuid4().hex}{subtitle_ext}"
    
    try:
        # Save video file
        video_path = os.path.join(UPLOAD_DIR, video_filename)
        async with aiofiles.open(video_path, 'wb') as f:
            content = await video.read()
            await f.write(content)
        
        # Save subtitle file
        if subtitle:
            subtitle_path = os.path.join(UPLOAD_DIR, subtitle_filename)
            async with aiofiles.open(subtitle_path, 'wb') as f:
                content = await subtitle.read()
                await f.write(content)
        
        # Create database record
        video_id = database.create_video(
            title=title,
            video_filename=video_filename,
            subtitle_filename=subtitle_filename
        )
        
        return {
            "id": video_id,
            "message": "Upload successful",
            "video_filename": video_filename,
            "subtitle_filename": subtitle_filename
        }
        
    except Exception as e:
        # Cleanup on error
        if os.path.exists(os.path.join(UPLOAD_DIR, video_filename)):
            os.remove(os.path.join(UPLOAD_DIR, video_filename))
        if subtitle_filename and os.path.exists(os.path.join(UPLOAD_DIR, subtitle_filename)):
            os.remove(os.path.join(UPLOAD_DIR, subtitle_filename))
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/videos/{video_id}")
async def delete_video(video_id: int):
    """Delete video and associated files"""
    video = database.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete files
    video_path = os.path.join(UPLOAD_DIR, video['video_filename'])
    if os.path.exists(video_path):
        os.remove(video_path)
    
    if video['subtitle_filename']:
        subtitle_path = os.path.join(UPLOAD_DIR, video['subtitle_filename'])
        if os.path.exists(subtitle_path):
            os.remove(subtitle_path)
    
    # Delete database record
    database.delete_video(video_id)
    
    return {"message": "Video deleted successfully"}


# Translation endpoints
import deepseek_service
import json

@app.get("/videos/{video_id}/translation")
async def get_translation(video_id: int):
    """Get or generate translation for a video's subtitles"""
    video = database.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if translation already exists
    if video.get('translation_filename'):
        translation_path = os.path.join(UPLOAD_DIR, "translations", video['translation_filename'])
        
        # Fallback to nginx folder if not found
        if not os.path.exists(translation_path) and NGINX_UPLOADS_DIR:
            translation_path = os.path.join(NGINX_UPLOADS_DIR, "translations", video['translation_filename'])
        
        if os.path.exists(translation_path):
            async with aiofiles.open(translation_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return {"translation": json.loads(content), "cached": True}
    
    # No translation exists - need subtitles to translate
    if not video.get('subtitle_filename'):
        raise HTTPException(status_code=400, detail="No subtitles available for this video")
    
    # Read subtitle content
    subtitle_path = os.path.join(UPLOAD_DIR, video['subtitle_filename'])
    if not os.path.exists(subtitle_path) and NGINX_UPLOADS_DIR:
        subtitle_path = os.path.join(NGINX_UPLOADS_DIR, video['subtitle_filename'])
    
    if not os.path.exists(subtitle_path):
        raise HTTPException(status_code=404, detail="Subtitle file not found")
    
    async with aiofiles.open(subtitle_path, 'r', encoding='utf-8') as f:
        subtitle_content = await f.read()
    
    # Parse VTT format (simple parsing)
    lines = subtitle_content.strip().split('\n')
    subtitles = []
    current_text = []
    
    for line in lines:
        line = line.strip()
        if line.startswith('WEBVTT') or '-->' in line or line.isdigit() or not line:
            if current_text:
                subtitles.append({'text': ' '.join(current_text)})
                current_text = []
        else:
            current_text.append(line)
    
    if current_text:
        subtitles.append({'text': ' '.join(current_text)})
    
    # Translate using DeepSeek
    try:
        translated = deepseek_service.translate_subtitle_batch(subtitles, video['title'])
        
        # Save translation
        translation_filename = deepseek_service.save_translation(video_id, translated, UPLOAD_DIR)
        
        # Update database
        database.update_video_translation(video_id, translation_filename)
        
        return {"translation": translated, "cached": False}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@app.post("/videos/{video_id}/translate")
async def force_translate(video_id: int):
    """Force regenerate translation for a video"""
    # Delete existing translation if any
    video = database.get_video(video_id)
    if video and video.get('translation_filename'):
        translation_path = os.path.join(UPLOAD_DIR, "translations", video['translation_filename'])
        if os.path.exists(translation_path):
            os.remove(translation_path)
    
    # Call get_translation which will regenerate
    return await get_translation(video_id)

class YoutubeRequest(BaseModel):
    url: str

@app.post("/videos/youtube")
async def start_youtube_process(request: YoutubeRequest, background_tasks: BackgroundTasks):
    """Start YouTube download and transcription task"""
    task_id = str(uuid.uuid4())
    background_tasks.add_task(
        youtube_service.process_youtube_video,
        task_id, 
        request.url, 
        UPLOAD_DIR, 
        database
    )
    return {"task_id": task_id}

@app.get("/videos/youtube/status/{task_id}")
async def get_youtube_status(task_id: str):
    """Get status of a YouTube task"""
    return youtube_service.get_task_status(task_id)

# Audio URL processing endpoints
import audio_url_service

class AudioUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None

@app.post("/videos/audio-url")
async def start_audio_url_process(request: AudioUrlRequest, background_tasks: BackgroundTasks):
    """Start audio URL download and transcription task"""
    task_id = str(uuid.uuid4())
    background_tasks.add_task(
        audio_url_service.process_audio_url,
        task_id,
        request.url,
        request.title,
        UPLOAD_DIR,
        database
    )
    return {"task_id": task_id}

@app.get("/videos/audio-url/status/{task_id}")
async def get_audio_url_status(task_id: str):
    """Get status of an audio URL task"""
    return audio_url_service.get_task_status(task_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
