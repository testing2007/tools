"""
Listen App - Video Library API
FastAPI backend for video + subtitle storage
"""

import os
import uuid
import aiofiles
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional

import database

# Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

# Mount uploads directory for static serving
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup():
    """Initialize database on startup"""
    try:
        database.init_database()
    except Exception as e:
        print(f"Database init warning: {e}")


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
    
    # Read subtitle content if exists
    subtitle_content = None
    if video['subtitle_filename']:
        subtitle_path = os.path.join(UPLOAD_DIR, video['subtitle_filename'])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
