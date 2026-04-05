<template>
  <div class="audio-url-processor">
    <div v-if="!taskInfo" class="input-section">
      <el-tabs v-model="importMode" class="import-tabs">
        <el-tab-pane label="URL 链接" name="url">
          <div class="tab-content">
            <el-input
              v-model="url"
              placeholder="粘贴音频链接 (例如: https://example.com/podcast.mp3)"
              clearable
              size="large"
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </div>
        </el-tab-pane>

        <el-tab-pane label="本地文件" name="upload">
          <div class="tab-content">
            <el-upload
              class="upload-demo"
              drag
              action="#"
              :auto-upload="false"
              :on-change="handleFileChange"
              accept="audio/*,video/*"
              :show-file-list="false"
            >
              <el-icon class="el-icon--upload"><Document /></el-icon>
              <div class="el-upload__text">
                拖拽音频/视频文件到这里或 <em>点击上传</em>
              </div>
            </el-upload>
            <div class="file-info" v-if="selectedFile">
              已选择文件: {{ selectedFile.name }}
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <el-input
        v-model="title"
        placeholder="标题 (可选，留空将自动从资源提取)"
        clearable
        size="large"
      >
        <template #prefix>
          <el-icon><EditPen /></el-icon>
        </template>
      </el-input>
      <div class="action-buttons">
        <el-button type="primary" :loading="loading" @click="startProcess" size="large">
          提取并转录
        </el-button>
      </div>
      <div class="info-tip">
        <el-icon><InfoFilled /></el-icon>
        <span>支持 mp3, m4a, wav, ogg, aac, mp4 等格式，后台将使用 AI 提取英文字幕</span>
      </div>
    </div>

    <div v-else class="progress-section">
      <div class="video-info" v-if="taskInfo.title">
        <h4 class="video-title">{{ taskInfo.title }}</h4>
      </div>

      <el-steps :active="activeStep" finish-status="success" direction="vertical">
        <el-step title="下载音频" :description="taskInfo.stepDescriptions[0]" />
        <el-step title="提取字幕 (Whisper AI)" :description="taskInfo.stepDescriptions[1]" />
        <el-step title="完成" :description="taskInfo.stepDescriptions[2]" />
      </el-steps>

      <div v-if="taskInfo.status === 'error'" class="error-msg">
        <el-alert :title="taskInfo.error" type="error" show-icon :closable="false" />
        <el-button @click="resetAll" style="margin-top: 15px">重试</el-button>
      </div>

      <div v-if="taskInfo.status === 'completed'" class="success-actions">
        <el-button type="success" @click="goToVideo" size="large">立即开启学习之旅</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { Link, InfoFilled, EditPen, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['processed'])
const importMode = ref('url')
const selectedFile = ref(null)
const url = ref('')
const title = ref('')
const loading = ref(false)
const taskInfo = ref(null)
const activeStep = ref(0)
const pollTimer = ref(null)

// API Base URL - adjust for production
const API_BASE = import.meta.env.PROD 
  ? '/tools/listen-api' 
  : 'http://localhost:8001'

const handleFileChange = (file) => {
  if (!file) return
  selectedFile.value = file.raw
}

const startProcess = async () => {
  if (importMode.value === 'url' && !url.value) {
    ElMessage.warning('请输入有效的链接')
    return
  }
  if (importMode.value === 'upload' && !selectedFile.value) {
    ElMessage.warning('请选择需要上传的文件')
    return
  }

  loading.value = true
  try {
    let response;
    if (importMode.value === 'url') {
      response = await fetch(`${API_BASE}/videos/audio-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.value, title: title.value || null })
      })
    } else {
      const formData = new FormData()
      formData.append('file', selectedFile.value)
      if (title.value) {
        formData.append('title', title.value)
      }
      response = await fetch(`${API_BASE}/videos/audio-upload`, {
        method: 'POST',
        body: formData
      })
    }

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || '提交任务失败')
    }

    const data = await response.json()
    taskInfo.value = {
      id: data.task_id,
      title: title.value || (importMode.value === 'url' ? '正在处理链接...' : '正在处理文件...'),
      status: 'processing',
      stepDescriptions: [importMode.value === 'url' ? '准备下载音频...' : '正在上传文件...', '等待开始...', '等待开始...'],
      error: ''
    }
    loading.value = false
    startPolling(data.task_id)
  } catch (error) {
    loading.value = false
    ElMessage.error(error.message)
  }
}

const startPolling = (taskId) => {
  pollTimer.value = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/videos/audio-url/status/${taskId}`)
      if (!response.ok) return
      
      const data = await response.json()

      taskInfo.value.status = data.status
      if (data.title) taskInfo.value.title = data.title
      if (data.stepDescriptions) {
        taskInfo.value.stepDescriptions = data.stepDescriptions
      }
      
      // Update active step based on status
      if (data.stepDescriptions) {
        if (data.stepDescriptions[1].includes('正在') || data.stepDescriptions[1].includes('转录')) {
          activeStep.value = 1
        }
        if (data.status === 'completed') {
          activeStep.value = 3
          taskInfo.value.video_id = data.video_id
          stopPolling()
        } else if (data.status === 'error') {
          taskInfo.value.error = data.error
          stopPolling()
        }
      }
    } catch (e) {
      console.error('Polling error', e)
    }
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

const goToVideo = async () => {
    if (!taskInfo.value?.video_id) return
    
    try {
        const response = await fetch(`${API_BASE}/videos/${taskInfo.value.video_id}`)
        if (!response.ok) throw new Error('无法连接到服务器')
        
        const video = await response.json()
        
        emit('processed', {
            id: video.id,
            title: video.title,
            videoUrl: `${API_BASE}/uploads/${video.video_filename}`,
            subtitleContent: video.subtitle_content,
            subtitles: parseSRT(video.subtitle_content)
        })
    } catch (e) {
        ElMessage.error('获取音频详情失败: ' + e.message)
    }
}

const parseSRT = (content) => {
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

    const text = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]*>/g, '').trim()

    if (text) {
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

const resetAll = () => {
  stopPolling()
  taskInfo.value = null
  activeStep.value = 0
  loading.value = false
  url.value = ''
  title.value = ''
  selectedFile.value = null
}

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.audio-url-processor {
  padding: 10px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.info-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #909399;
    background: #f4f4f5;
    padding: 12px;
    border-radius: 4px;
}

.video-info {
  margin-bottom: 20px;
  text-align: center;
}

.video-title {
  font-size: 16px;
  color: #303133;
  margin: 0;
  line-height: 1.4;
}

.progress-section {
    padding: 10px 0;
}

.error-msg {
  margin-top: 20px;
}

.success-actions {
  margin-top: 30px;
  text-align: center;
}

:deep(.el-step__description) {
    font-size: 13px;
    margin-top: 4px;
}

.import-tabs {
  margin-bottom: 5px;
}

.tab-content {
  padding: 10px 0;
}

.file-info {
  margin-top: 10px;
  font-size: 14px;
  color: #409eff;
  text-align: center;
}

:deep(.el-upload-dragger) {
  padding: 20px;
}
</style>
