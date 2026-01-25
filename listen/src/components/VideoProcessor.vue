<template>
  <div class="video-processor">
    <div class="upload-section">
      <el-upload
        class="upload-demo"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleVideoChange"
        accept="video/*"
      >
        <el-icon class="el-icon--upload"><VideoCamera /></el-icon>
        <div class="el-upload__text">
          拖拽视频文件到这里或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">支持 MP4、MKV、WebM 视频文件</div>
        </template>
      </el-upload>
    </div>

    <!-- Video preview and subtitle handling -->
    <div v-if="videoFile" class="preview-section">
      <el-divider>视频预览</el-divider>
      <p class="file-info">已选择: {{ videoFile.name }}</p>

      <video
        ref="videoEl"
        class="preview-video"
        crossorigin="anonymous"
      >
        <source :src="videoUrl" />
      </video>

      <!-- Subtitle Upload Section -->
      <div class="subtitle-upload-section">
        <el-divider>上传字幕文件</el-divider>
        <el-upload
          class="srt-upload"
          action="#"
          :auto-upload="false"
          :on-change="handleSubtitleFile"
          accept=".srt,.vtt"
          :show-file-list="false"
        >
          <el-button type="primary" size="large">
            <el-icon><Document /></el-icon>
            选择字幕文件 (SRT/VTT)
          </el-button>
        </el-upload>
        <p class="upload-tip">请上传与视频匹配的 SRT 或 VTT 字幕文件</p>
      </div>

      <!-- Subtitle Preview Count -->
      <div v-if="subtitles.length > 0" class="subtitle-preview">
        <el-alert type="success" :closable="false">
          已解析 {{ subtitles.length }} 条英文字幕（来自 {{ subtitleFileName }}）
        </el-alert>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons" v-if="subtitles.length > 0">
        <el-button type="primary" @click="confirmImport" :loading="processing" size="large">
          开始学习
        </el-button>
        <el-button @click="resetAll">重新选择</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { VideoCamera, Document } from '@element-plus/icons-vue'

const emit = defineEmits(['processed'])

const videoFile = ref(null)
const videoUrl = ref('')
const videoEl = ref(null)
const processing = ref(false)

const subtitles = ref([])
const subtitleFileName = ref('')
const rawSubtitleContent = ref('')

const handleVideoChange = async (file) => {
  if (!file) return
  
  videoFile.value = file
  videoUrl.value = URL.createObjectURL(file.raw)
  subtitles.value = []
  subtitleFileName.value = ''
  rawSubtitleContent.value = ''
}

// Parse SRT format
const parseSRT = (content) => {
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

    // Filter Chinese - keep English only
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

// Parse VTT format
const parseVTT = (content) => {
  const lines = content.split('\n')
  const result = []
  let i = 0

  while (i < lines.length && !lines[i].includes('-->')) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i]
    const timeMatch = line.match(/(\d{2}):(\d{2}):?(\d{2})?[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):?(\d{2})?[.,](\d{3})/)
    
    if (timeMatch) {
      let startTime, endTime
      
      if (timeMatch[3] !== undefined) {
        startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000
        endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000
      } else {
        startTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) + parseInt(timeMatch[4]) / 1000
        endTime = parseInt(timeMatch[5]) * 60 + parseInt(timeMatch[6]) + parseInt(timeMatch[8]) / 1000
      }

      i++
      let text = ''
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        text += (text ? ' ' : '') + lines[i].replace(/<[^>]*>/g, '').trim()
        i++
      }

      if (text && !/[\u4e00-\u9fa5]/.test(text) && text.length > 1) {
        result.push({
          id: result.length + 1,
          startTime,
          endTime,
          text
        })
      }
    } else {
      i++
    }
  }

  return result
}

const handleSubtitleFile = async (file) => {
  if (!file) return
  
  const content = await file.raw.text()
  const fileName = file.name.toLowerCase()

  let parsed = []
  if (fileName.endsWith('.srt')) {
    parsed = parseSRT(content)
  } else if (fileName.endsWith('.vtt')) {
    parsed = parseVTT(content)
  }

  if (parsed.length > 0) {
    rawSubtitleContent.value = content
    subtitles.value = parsed
    subtitleFileName.value = file.name
  }
}

const confirmImport = () => {
  if (subtitles.value.length === 0) return

  processing.value = true
  
  setTimeout(() => {
    emit('processed', {
      videoUrl: videoUrl.value,
      subtitles: subtitles.value,
      subtitleContent: rawSubtitleContent.value
    })
    processing.value = false
  }, 300)
}

const resetAll = () => {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value)
  }
  videoFile.value = null
  videoUrl.value = ''
  subtitles.value = []
  subtitleFileName.value = ''
  rawSubtitleContent.value = ''
}

onUnmounted(() => {
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value)
  }
})
</script>

<style scoped>
.video-processor {
  padding: 10px;
}

.preview-section {
  margin-top: 20px;
}

.file-info {
  font-size: 13px;
  color: #409eff;
  margin-bottom: 15px;
}

.preview-video {
  width: 100%;
  max-height: 200px;
  background: #000;
  border-radius: 8px;
}

.subtitle-upload-section {
  margin-top: 15px;
  text-align: center;
}

.srt-upload {
  display: inline-block;
}

.upload-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}

.subtitle-preview {
  margin-top: 15px;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
