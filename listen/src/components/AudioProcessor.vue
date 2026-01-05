<template>
  <div class="audio-processor">
    <!-- Controls shown before processing -->
    <div v-if="!processing" class="upload-controls">
      <el-upload
        class="upload-demo"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        accept="audio/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          Drop audio file here or <em>click to upload</em>
        </div>
      </el-upload>

      <div class="time-range-settings" v-if="selectedFile">
        <el-divider>Time Range Selection</el-divider>
        <p class="file-info">Selected: {{ selectedFile.name }}</p>
        <p class="duration-info" v-if="totalDuration > 0">Total Duration: {{ formatTime(totalDuration) }}</p>
        
        <div class="slider-container" v-if="totalDuration > 0">
          <el-slider
            v-model="timeRange"
            range
            :max="totalDuration"
            :format-tooltip="formatTime"
            @change="handleSliderChange"
          />
          <div class="range-labels">
            <span>Start: {{ formatTime(timeRange[0]) }}</span>
            <span>End: {{ formatTime(timeRange[1]) }}</span>
          </div>
        </div>

        <el-button 
          type="primary" 
          style="margin-top: 20px; width: 100%;" 
          @click="processAudio"
          :loading="loadingFile"
        >
          {{ loadingFile ? 'Preparing Audio...' : 'Start AI Analysis' }}
        </el-button>
        <el-button type="info" plain style="margin-top: 10px; width: 100%;" @click="resetFile">Select Another File</el-button>
      </div>
    </div>

    <!-- Progress status during processing -->
    <div v-if="processing" class="processing-status">
      <el-progress 
        type="circle" 
        :percentage="Math.round(progress)" 
        :status="progress === 100 ? 'success' : ''"
        :stroke-width="10"
      />
      <p class="status-msg">{{ statusText }}</p>
      <div style="margin-top: 15px;">
        <el-button size="small" type="danger" plain @click="cancelProcessing">Cancel Processing</el-button>
      </div>
      <p class="sub-status" v-if="sentencesFound > 0">
        Extracted {{ sentencesFound }} valid English sentences...
      </p>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-box">
      <el-alert :title="error" type="error" show-icon :closable="false" />
      <el-button type="primary" link @click="reset" style="margin-top: 10px;">Try Again</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineEmits } from 'vue'
import { pipeline, env } from '@xenova/transformers'
import { UploadFilled } from '@element-plus/icons-vue'

const emit = defineEmits(['processed'])

// UI States
const processing = ref(false)
const loadingFile = ref(false)
const progress = ref(0)
const statusText = ref('')
const error = ref('')
const sentencesFound = ref(0)

// File and Setting States
const selectedFile = ref(null)
const totalDuration = ref(0)
const timeRange = ref([0, 0])

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const handleSliderChange = (val) => {
  timeRange.value = val
}

const handleFileChange = async (file) => {
  if (!file) return
  selectedFile.value = file
  loadingFile.value = true
  error.value = ''
  
  try {
    // Get audio duration without full buffer decode if possible, 
    // but for precision we use the first few bytes or a temp audio element
    const url = URL.createObjectURL(file.raw)
    const audio = new Audio()
    audio.src = url
    
    await new Promise((resolve) => {
      audio.onloadedmetadata = () => {
        totalDuration.value = Math.floor(audio.duration)
        timeRange.value = [0, totalDuration.value]
        resolve()
      }
      audio.onerror = () => {
        console.warn('Metadata load failed, falling back to basic info')
        resolve() // Fallback handled by 0 duration
      }
    })
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('File metadata error:', err)
  } finally {
    loadingFile.value = false
  }
}

const resetFile = () => {
  selectedFile.value = null
  totalDuration.value = 0
  timeRange.value = [0, 0]
}

// Transformers.js Config
env.allowLocalModels = true;
env.allowRemoteModels = true; 
env.localModelPath = '/models/'; 
env.useBrowserCache = true;

let transcriber = null
const filesProgress = ref({})

const totalLoadProgress = computed(() => {
  const values = Object.values(filesProgress.value)
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
})

const initTranscriber = async () => {
  if (transcriber) return transcriber
  statusText.value = 'Preparing AI Engine...'
  progress.value = 0
  filesProgress.value = {}
  
  try {
    transcriber = await pipeline('automatic-speech-recognition', 'whisper-tiny.en', {
      progress_callback: (p) => {
        if (p.status === 'progress') {
          filesProgress.value[p.file] = p.progress
          progress.value = totalLoadProgress.value
        } else if (p.status === 'ready') {
          statusText.value = 'AI Engine Ready.'
          progress.value = 100
        }
      }
    })
    return transcriber
  } catch (err) {
    console.error('Pipeline error:', err)
    throw new Error('Failed to load AI model. Please ensure files are in public/models/.')
  }
}

const processAudio = async () => {
  if (!selectedFile.value) return
  
  processing.value = true
  progress.value = 0
  error.value = ''
  sentencesFound.value = 0
  
  try {
    const p = await initTranscriber()
    const file = selectedFile.value
    
    statusText.value = 'Reading audio file...'
    const arrayBuffer = await file.raw.arrayBuffer()
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    statusText.value = 'Decoding audio data...'
    await new Promise(r => setTimeout(r, 50)) // Allow UI update

    const audioBuffer = await new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, (err) => {
        console.error('Decode error:', err)
        reject(new Error('Failed to decode audio. The file might be corrupted.'))
      })
    })

    statusText.value = 'Processing time slice...'
    await new Promise(r => setTimeout(r, 50))

    // Audio Meta
    const sourceRate = audioBuffer.sampleRate
    const targetRate = 16000
    const rawData = audioBuffer.getChannelData(0)
    
    // Calculate sample range
    let startSample = Math.floor(timeRange.value[0] * sourceRate)
    let endSample = Math.floor(timeRange.value[1] * sourceRate)
    
    // Bounds check
    startSample = Math.max(0, Math.min(startSample, rawData.length - 1))
    endSample = Math.max(startSample + 1, Math.min(endSample, rawData.length))
    
    // Slice and Resample
    const clippedRawData = rawData.slice(startSample, endSample)
    const targetLength = Math.round(clippedRawData.length * (targetRate / sourceRate))
    const audioData = new Float32Array(targetLength)
    
    statusText.value = 'Optimizing audio for AI...'
    for (let i = 0; i < targetLength; i++) {
      const srcIdx = i * (sourceRate / targetRate)
      const leftIdx = Math.floor(srcIdx)
      const rightIdx = Math.min(leftIdx + 1, clippedRawData.length - 1)
      const weight = srcIdx - leftIdx
      audioData[i] = clippedRawData[leftIdx] * (1 - weight) + clippedRawData[rightIdx] * weight
    }
    
    console.log(`Audio ready: ${audioData.length} samples at 16kHz. Range: ${timeRange.value[0]}s to ${timeRange.value[1]}s`)

    // Sequential Chunking Transcription
    const segmentDuration = 60; // seconds
    const segmentSamples = segmentDuration * 16000;
    const totalSegments = Math.ceil(audioData.length / segmentSamples);
    const offsetBase = timeRange.value[0];
    
    let allChunks = [];

    for (let i = 0; i < totalSegments; i++) {
        if (!processing.value) break // Handle cancellation
        
        statusText.value = `AI Transcribing Part ${i + 1} of ${totalSegments}...`
        // Force progress bar update
        progress.value = Math.round((i / totalSegments) * 100);
        await new Promise(r => setTimeout(r, 50))
        
        const startIdx = i * segmentSamples;
        const endIdx = Math.min(startIdx + segmentSamples, audioData.length);
        const chunkData = audioData.slice(startIdx, endIdx);
        
        const result = await p(chunkData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true
        });
        
        if (result.chunks) {
            const currentOffset = offsetBase + (startIdx / 16000);
            const adjusted = result.chunks.map(c => ({
                ...c,
                timestamp: [c.timestamp[0] + currentOffset, c.timestamp[1] + currentOffset]
            }));
            allChunks.push(...adjusted);
            sentencesFound.value = allChunks.filter(c => c.text.length > 5).length
        }
    }

    if (!processing.value) return; // Silent return on cancel

    statusText.value = 'Filtering background noise...'
    progress.value = 100
    await new Promise(r => setTimeout(r, 50))

    const finalSentences = allChunks
        .map((chunk, index) => ({
            id: index + 1,
            text: chunk.text.trim(),
            timestamp: chunk.timestamp
        }))
        .filter(s => {
            const text = s.text.toLowerCase();
            // 1. Remove non-speech tags like [Music], [Laughter], (Music)
            if (/\[.*\]|\(.*\)/.test(text)) return false;
            // 2. Remove isolated 'music' keywords
            if (text.includes('music') && text.length < 10) return false;
            // 3. Remove artifacts like single dots
            if (text === '.' || text === '...') return false;
            // 4. Must be English (no Chinese) and reasonable length
            return s.text.length > 3 && !/[\u4e00-\u9fa5]/.test(s.text);
        });

    if (finalSentences.length === 0) {
      throw new Error('No valid English sentences found in this range.')
    }

    statusText.value = 'Analysis complete!'
    setTimeout(() => {
      emit('processed', finalSentences)
    }, 800)

  } catch (err) {
    console.error('Processing error:', err)
    error.value = err.message || 'Error occurred during analysis.'
    processing.value = false
  }
}

const cancelProcessing = () => {
  processing.value = false
  statusText.value = 'Cancelled.'
}

const reset = () => {
  processing.value = false
  error.value = ''
  progress.value = 0
  selectedFile.value = null
}
</script>

<style scoped>
.audio-processor {
  padding: 10px;
  text-align: center;
}

.upload-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.file-info {
  font-size: 13px;
  color: #409eff;
  margin-bottom: 10px;
}

.time-range-settings {
  background: #fdfdfd;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}

.duration-info {
  font-size: 14px;
  color: #606266;
  margin-bottom: 20px;
}

.slider-container {
  padding: 0 20px;
  margin: 30px 0;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 13px;
  color: #909399;
}

.processing-status {
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.status-msg {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.sub-status {
  font-size: 13px;
  color: #67c23a;
  background: #f0f9eb;
  padding: 5px 15px;
  border-radius: 20px;
}

.error-box {
  margin-top: 15px;
}
</style>
