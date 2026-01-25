<template>
  <div class="video-library">
    <!-- Header -->
    <div class="library-header">
      <h2><el-icon><Film /></el-icon> 视频库</h2>
      <el-button type="primary" @click="showUploadDialog = true">
        <el-icon><Plus /></el-icon>
        <span class="btn-text">上传视频</span>
      </el-button>
    </div>

    <!-- Video List -->
    <div class="video-grid" v-if="videos.length > 0">
      <div 
        v-for="video in videos" 
        :key="video.id" 
        class="video-card"
        @click="selectVideo(video)"
      >
        <div class="video-thumbnail">
          <el-icon :size="40"><VideoPlay /></el-icon>
        </div>
        <div class="video-info">
          <h3 class="video-title">{{ video.title }}</h3>
          <p class="video-date">{{ video.created_at }}</p>
        </div>
        <div class="video-actions" @click.stop>
          <el-button type="danger" size="small" circle @click="confirmDelete(video)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <el-empty description="暂无视频">
        <el-button type="primary" @click="showUploadDialog = true">上传第一个视频</el-button>
      </el-empty>
    </div>

    <!-- Upload Dialog -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传视频"
      :width="isMobile ? '95%' : '500px'"
      append-to-body
    >
      <el-form :model="uploadForm" label-position="top">
        <el-form-item label="视频标题" required>
          <el-input v-model="uploadForm.title" placeholder="请输入视频标题" />
        </el-form-item>
        
        <el-form-item label="视频文件" required>
          <el-upload
            class="upload-area"
            action="#"
            :auto-upload="false"
            :on-change="handleVideoFile"
            accept="video/*"
            :show-file-list="false"
          >
            <el-button type="primary" plain>
              {{ uploadForm.videoFile ? uploadForm.videoFile.name : '选择视频文件' }}
            </el-button>
          </el-upload>
        </el-form-item>
        
        <el-form-item label="字幕文件 (SRT/VTT)">
          <el-upload
            class="upload-area"
            action="#"
            :auto-upload="false"
            :on-change="handleSubtitleFile"
            accept=".srt,.vtt"
            :show-file-list="false"
          >
            <el-button type="success" plain>
              {{ uploadForm.subtitleFile ? uploadForm.subtitleFile.name : '选择字幕文件' }}
            </el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      
      <div v-if="uploadProgress > 0" class="upload-progress">
        <el-progress :percentage="uploadProgress" />
      </div>
      
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleUpload" 
          :loading="uploading"
          :disabled="!uploadForm.title || !uploadForm.videoFile"
        >
          上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Film, Plus, VideoPlay, Delete } from '@element-plus/icons-vue'

const emit = defineEmits(['select'])

// API Base URL - adjust for production
const API_BASE = import.meta.env.PROD 
  ? '/tools/listen-api' 
  : 'http://localhost:8001'

const videos = ref([])
const showUploadDialog = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)

const uploadForm = ref({
  title: '',
  videoFile: null,
  subtitleFile: null
})

const isMobile = computed(() => window.innerWidth < 768)

const fetchVideos = async () => {
  try {
    const res = await fetch(`${API_BASE}/videos`)
    const data = await res.json()
    videos.value = data.videos || []
  } catch (err) {
    console.error('Failed to fetch videos:', err)
    ElMessage.error('获取视频列表失败')
  }
}

const handleVideoFile = (file) => {
  uploadForm.value.videoFile = file
  // Auto-fill title from filename
  if (!uploadForm.value.title) {
    uploadForm.value.title = file.name.replace(/\.[^/.]+$/, '')
  }
}

const handleSubtitleFile = (file) => {
  uploadForm.value.subtitleFile = file
}

const handleUpload = async () => {
  if (!uploadForm.value.title || !uploadForm.value.videoFile) {
    ElMessage.warning('请填写标题并选择视频文件')
    return
  }
  
  uploading.value = true
  uploadProgress.value = 0
  
  const formData = new FormData()
  formData.append('title', uploadForm.value.title)
  formData.append('video', uploadForm.value.videoFile.raw)
  if (uploadForm.value.subtitleFile) {
    formData.append('subtitle', uploadForm.value.subtitleFile.raw)
  }
  
  try {
    const xhr = new XMLHttpRequest()
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          reject(new Error(xhr.statusText))
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.open('POST', `${API_BASE}/videos/upload`)
      xhr.send(formData)
    })
    
    ElMessage.success('上传成功')
    showUploadDialog.value = false
    uploadForm.value = { title: '', videoFile: null, subtitleFile: null }
    uploadProgress.value = 0
    await fetchVideos()
    
  } catch (err) {
    console.error('Upload error:', err)
    ElMessage.error('上传失败: ' + err.message)
  } finally {
    uploading.value = false
  }
}

const selectVideo = async (video) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${video.id}`)
    const data = await res.json()
    
    emit('select', {
      videoUrl: `${API_BASE}/uploads/${data.video_filename}`,
      subtitles: parseSubtitles(data.subtitle_content),
      subtitleContent: data.subtitle_content || '',
      title: data.title
    })
  } catch (err) {
    console.error('Failed to get video:', err)
    ElMessage.error('获取视频失败')
  }
}

const confirmDelete = (video) => {
  ElMessageBox.confirm(`确定删除"${video.title}"吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await fetch(`${API_BASE}/videos/${video.id}`, { method: 'DELETE' })
      ElMessage.success('删除成功')
      await fetchVideos()
    } catch (err) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// Parse SRT/VTT content
const parseSubtitles = (content) => {
  if (!content) return []
  
  const blocks = content.trim().split(/\n\n+/)
  const result = []

  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 2) continue

    let timeLineIdx = 0
    if (!/-->/.test(lines[0])) timeLineIdx = 1
    if (timeLineIdx >= lines.length) continue

    const timeLine = lines[timeLineIdx]
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!timeMatch) continue

    const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000
    const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000

    const text = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim()

    if (text && !/[\u4e00-\u9fa5]/.test(text) && text.length > 1) {
      result.push({
        id: result.length + 1,
        startTime,
        endTime,
        text
      })
    }
  }

  return result
}

onMounted(() => {
  fetchVideos()
})
</script>

<style scoped>
.video-library {
  padding: 20px;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.library-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
}

.video-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.video-thumbnail {
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.video-info {
  padding: 15px;
}

.video-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-date {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.video-actions {
  padding: 0 15px 15px;
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
}

.upload-area {
  width: 100%;
}

.upload-progress {
  margin-top: 15px;
}

/* Mobile Styles */
@media (max-width: 768px) {
  .video-library {
    padding: 15px;
  }
  
  .library-header h2 {
    font-size: 18px;
  }
  
  .btn-text {
    display: none;
  }
  
  .video-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .video-card {
    display: flex;
    align-items: center;
  }
  
  .video-thumbnail {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }
  
  .video-thumbnail .el-icon {
    font-size: 24px !important;
  }
  
  .video-info {
    flex: 1;
    padding: 10px 15px;
  }
  
  .video-actions {
    padding: 10px;
  }
}
</style>
