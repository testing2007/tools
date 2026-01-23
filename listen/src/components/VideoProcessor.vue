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
        :disabled="extracting"
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

      <!-- Loading/Extraction Progress -->
      <div class="extraction-status" v-if="extracting">
        <el-progress :percentage="extractProgress" :status="extractProgress === 100 ? 'success' : ''" />
        <p>{{ extractStatus }}</p>
        <el-button type="warning" size="small" @click="skipExtraction" style="margin-top: 10px;">
          跳过检测，手动上传字幕
        </el-button>
      </div>

      <!-- Extracted Subtitle Tracks -->
      <div class="subtitle-tracks" v-if="!extracting && subtitleTracks.length > 0">
        <el-alert type="success" :closable="false" style="margin-bottom: 15px;">
          检测到 {{ subtitleTracks.length }} 个字幕轨道
        </el-alert>
        <el-select v-model="selectedTrackIndex" placeholder="选择字幕轨道" style="width: 100%;">
          <el-option
            v-for="(track, idx) in subtitleTracks"
            :key="idx"
            :label="track.label"
            :value="idx"
          />
        </el-select>
      </div>

      <!-- Manual Subtitle Upload (always available after extraction attempt) -->
      <div class="subtitle-upload" v-if="!extracting && extractionDone">
        <el-divider v-if="subtitleTracks.length === 0">上传字幕文件</el-divider>
        <el-alert v-if="subtitleTracks.length === 0" type="info" :closable="false" style="margin-bottom: 15px;">
          该视频没有内嵌字幕，请上传 SRT 或 VTT 字幕文件
        </el-alert>
        <el-upload
          class="srt-upload"
          action="#"
          :auto-upload="false"
          :on-change="handleSubtitleFile"
          accept=".srt,.vtt"
        >
          <el-button type="primary" :plain="subtitleTracks.length > 0">
            {{ subtitleTracks.length > 0 ? '或使用其他字幕文件' : '上传字幕文件 (SRT/VTT)' }}
          </el-button>
        </el-upload>
      </div>

      <!-- Subtitle Preview Count -->
      <div v-if="subtitles.length > 0" class="subtitle-preview">
        <el-alert type="success" :closable="false" style="margin-top: 15px;">
          已解析 {{ subtitles.length }} 条英文字幕
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
import { ref, onUnmounted, watch } from 'vue'
import { VideoCamera } from '@element-plus/icons-vue'

const emit = defineEmits(['processed'])

const videoFile = ref(null)
const videoUrl = ref('')
const videoEl = ref(null)

const extracting = ref(false)
const extractionDone = ref(false)
const extractProgress = ref(0)
const extractStatus = ref('')
const processing = ref(false)

const subtitleTracks = ref([])
const selectedTrackIndex = ref(null)
const subtitles = ref([])
const rawSubtitleContent = ref('')

const handleVideoChange = async (file) => {
  if (!file) return
  
  videoFile.value = file
  videoUrl.value = URL.createObjectURL(file.raw)
  extractionDone.value = false
  subtitleTracks.value = []
  subtitles.value = []
  selectedTrackIndex.value = null
  rawSubtitleContent.value = ''

  // Try to extract subtitles
  await tryExtractSubtitles(file.raw)
}

const tryExtractSubtitles = async (file) => {
  extracting.value = true
  extractProgress.value = 0
  extractStatus.value = '正在加载字幕提取引擎...'

  try {
    // Dynamic import ffmpeg only when needed
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util')
    
    extractProgress.value = 10
    
    const ffmpeg = new FFmpeg()
    
    ffmpeg.on('progress', ({ progress }) => {
      extractProgress.value = Math.min(20 + Math.round(progress * 60), 80)
    })

    // Load FFmpeg with timeout
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    
    const loadPromise = ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    
    // 30 second timeout for loading
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('加载超时')), 30000)
    )
    
    await Promise.race([loadPromise, timeoutPromise])
    
    extractProgress.value = 25
    extractStatus.value = '正在读取视频文件...'
    
    // Write video file
    const inputName = 'input' + getFileExtension(file.name)
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    
    extractProgress.value = 50
    extractStatus.value = '正在提取字幕轨道...'

    // Try to extract subtitle tracks
    const tracks = []
    for (let i = 0; i < 3; i++) {
      const outputName = `sub_${i}.srt`
      
      try {
        await ffmpeg.exec([
          '-i', inputName,
          '-map', `0:s:${i}`,
          '-c:s', 'srt',
          outputName
        ])
        
        const data = await ffmpeg.readFile(outputName)
        const content = new TextDecoder().decode(data)
        
        if (content && content.trim().length > 10) {
          const parsed = parseSRT(content)
          if (parsed.length > 0) {
            tracks.push({
              index: i,
              label: `字幕轨 ${i + 1} (${parsed.length}条)`,
              content: content,
              subtitles: parsed
            })
          }
        }
        
        await ffmpeg.deleteFile(outputName)
      } catch (e) {
        break
      }
    }

    await ffmpeg.deleteFile(inputName)

    extractProgress.value = 100
    subtitleTracks.value = tracks
    extractionDone.value = true

    if (tracks.length > 0) {
      extractStatus.value = `成功提取 ${tracks.length} 个字幕轨道`
      selectedTrackIndex.value = 0
    } else {
      extractStatus.value = '未找到内嵌字幕'
    }

  } catch (err) {
    console.error('Subtitle extraction error:', err)
    extractStatus.value = '字幕提取失败，请手动上传字幕文件'
    extractionDone.value = true
  } finally {
    setTimeout(() => {
      extracting.value = false
    }, 300)
  }
}

const skipExtraction = () => {
  extracting.value = false
  extractionDone.value = true
  subtitleTracks.value = []
}

const getFileExtension = (filename) => {
  const ext = filename.split('.').pop()
  return ext ? `.${ext.toLowerCase()}` : '.mp4'
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
    subtitleTracks.value = [{
      index: 0,
      label: `${file.name} (${parsed.length}条)`,
      content: content,
      subtitles: parsed
    }]
    selectedTrackIndex.value = 0
  }
}

// Watch track selection
watch(selectedTrackIndex, (idx) => {
  if (idx !== null && subtitleTracks.value[idx]) {
    subtitles.value = subtitleTracks.value[idx].subtitles
    rawSubtitleContent.value = subtitleTracks.value[idx].content
  } else {
    subtitles.value = []
  }
})

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
  extractionDone.value = false
  subtitleTracks.value = []
  subtitles.value = []
  selectedTrackIndex.value = null
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

.extraction-status {
  margin-top: 15px;
  text-align: center;
}

.extraction-status p {
  margin-top: 10px;
  color: #606266;
  font-size: 14px;
}

.subtitle-tracks,
.subtitle-upload,
.subtitle-preview {
  margin-top: 15px;
}

.srt-upload {
  display: inline-block;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
