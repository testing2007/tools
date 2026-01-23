<template>
  <div class="pdf-processor">
    <!-- Step 1: Upload or Paste Text -->
    <div v-if="step === 1" class="upload-step">
      <el-tabs v-model="inputMode" class="input-tabs">
        <el-tab-pane label="Upload PDF" name="pdf">
          <el-upload
            class="upload-area"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handlePdfChange"
            accept=".pdf"
            :loading="loading"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽 PDF 文件到这里 或 <em>点击上传</em>
            </div>
          </el-upload>
          <el-alert
            title="提示：PDF 解析可能产生乱码，系统会自动过滤只保留英语句子。"
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 10px"
          />
        </el-tab-pane>
        
        <el-tab-pane label="Paste Text" name="text">
          <el-input
            v-model="rawText"
            type="textarea"
            :rows="10"
            placeholder="直接粘贴英语对话文本..."
          />
          <el-button 
            type="primary" 
            style="margin-top: 15px; width: 100%"
            @click="processText"
            :disabled="!rawText.trim()"
          >
            提取英语句子
          </el-button>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Step 2: Preview Results -->
    <div v-if="step === 2" class="result-step">
      <div class="step-header">
        <h4>✅ 提取到 {{ sentences.length }} 条英语句子</h4>
        <el-button size="small" @click="step = 1">← 重新选择</el-button>
      </div>
      
      <div class="dialogue-list">
        <div 
          v-for="(item, index) in sentences" 
          :key="index"
          class="dialogue-item"
          :class="index % 2 === 0 ? 'speaker-a' : 'speaker-b'"
        >
          <span class="speaker-tag">{{ index % 2 === 0 ? 'A' : 'B' }}</span>
          <span class="dialogue-text">{{ item }}</span>
        </div>
      </div>
      
      <el-button 
        type="success" 
        style="margin-top: 20px; width: 100%"
        @click="confirmAndEmit"
      >
        ✓ 确认并开始盲听练习
      </el-button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>正在解析 PDF...</p>
    </div>

    <!-- Error display -->
    <el-alert 
      v-if="error" 
      :title="error" 
      type="error" 
      show-icon 
      closable 
      @close="error = ''"
      style="margin-top: 15px"
    />
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue'
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker - use base URL for deployment
pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`

const emit = defineEmits(['processed'])

// State
const step = ref(1)
const inputMode = ref('text')
const rawText = ref('')
const sentences = ref([])
const loading = ref(false)
const error = ref('')

// PDF handling
const handlePdfChange = async (file) => {
  if (!file) return
  
  loading.value = true
  error.value = ''
  
  try {
    const arrayBuffer = await file.raw.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    
    let extractedText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      extractedText += pageText + '\n'
    }
    
    rawText.value = extractedText.trim()
    processText()
  } catch (err) {
    console.error('PDF parsing error:', err)
    error.value = 'PDF 解析失败，请检查文件格式'
  } finally {
    loading.value = false
  }
}

// Extract English sentences from text
const processText = () => {
  if (!rawText.value.trim()) {
    error.value = '请先输入文本内容'
    return
  }
  
  const extracted = preprocessEnglishSentences(rawText.value)
  
  if (extracted.length === 0) {
    error.value = '未能提取到有效的英语句子，请检查文本内容'
    return
  }
  
  sentences.value = extracted
  step.value = 2
}

// Local preprocessing - extract only valid English sentences
const preprocessEnglishSentences = (text) => {
  // Split by common delimiters
  const lines = text.split(/[\n。！？]/).map(s => s.trim()).filter(Boolean)
  
  const englishSentences = []
  
  for (const line of lines) {
    // Split further by sentence-ending punctuation
    const segments = line.split(/(?<=[.!?])\s+/)
    
    for (const segment of segments) {
      const trimmed = segment.trim()
      if (!trimmed) continue
      
      // Check if it's a valid English sentence
      const englishLetters = (trimmed.match(/[a-zA-Z]/g) || []).length
      const totalChars = trimmed.length
      const englishRatio = englishLetters / totalChars
      
      // Skip if too much non-English content (less than 50% English)
      if (englishRatio < 0.5) continue
      
      // Skip if contains Chinese characters (translations)
      if (/[\u4e00-\u9fa5]/.test(trimmed)) continue
      
      // Skip page headers/footers patterns
      if (/^\d+\/\d+/.test(trimmed)) continue
      if (/关注|获取|Daily Read|磨耳|CEFR|雅思|托福|适合|难度/.test(trimmed)) continue
      
      // Skip garbled text (unusual Unicode ranges)
      if (/[\u0500-\u052F\u2E80-\u2EFF\u3400-\u4DBF]/.test(trimmed)) continue
      
      // Must have at least 3 words
      const words = trimmed.split(/\s+/).filter(w => w.length > 0)
      if (words.length < 3) continue
      
      // Clean up and add
      const cleaned = trimmed.replace(/\s+/g, ' ').trim()
      if (cleaned && !englishSentences.includes(cleaned)) {
        englishSentences.push(cleaned)
      }
    }
  }
  
  return englishSentences
}

const confirmAndEmit = () => {
  // Convert to listening format with alternating speakers
  const result = sentences.value.map((text, index) => ({
    id: index + 1,
    text,
    speaker: index % 2 === 0 ? 'Speaker A' : 'Speaker B',
    timestamp: [0, 0]
  }))
  
  emit('processed', result)
}
</script>

<style scoped>
.pdf-processor {
  padding: 10px;
  position: relative;
}

.input-tabs {
  margin-top: 10px;
}

.upload-area {
  width: 100%;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.step-header h4 {
  margin: 0;
  color: #303133;
}

.dialogue-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 15px;
  background: #fafafa;
}

.dialogue-item {
  padding: 12px 15px;
  margin-bottom: 10px;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.dialogue-item:last-child {
  margin-bottom: 0;
}

.dialogue-item.speaker-a {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-left: 4px solid #2196f3;
}

.dialogue-item.speaker-b {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-left: 4px solid #4caf50;
}

.speaker-tag {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0,0,0,0.1);
  white-space: nowrap;
}

.dialogue-text {
  flex: 1;
  line-height: 1.5;
  color: #303133;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  z-index: 10;
  border-radius: 8px;
}

.loading-overlay p {
  color: #606266;
  margin: 0;
}
</style>
