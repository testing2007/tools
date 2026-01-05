<template>
  <div class="listening-bench">
    <div class="bench-header">
      <h2><el-icon><Headset /></el-icon> Listening Practice</h2>
      <div class="voice-selector">
        <span>Voice: </span>
        <el-select v-model="selectedVoiceName" placeholder="Select Voice" size="small" style="width: 200px">
          <el-option
            v-for="voice in femaleVoices"
            :key="voice.name"
            :label="voice.name"
            :value="voice.name"
          />
        </el-select>
      </div>
    </div>

    <div class="sentence-list">
      <el-card v-for="(s, index) in sentences" :key="s.id" class="sentence-card" :class="{ 'is-active': activeId === s.id }">
        <div class="card-left">
          <div class="index-badge">{{ index + 1 }}</div>
          <el-button type="primary" circle @click="playSentence(s)">
            <el-icon :size="20"><VideoPlay /></el-icon>
          </el-button>
        </div>
        
        <div class="card-content">
          <div v-if="revealedIds.has(s.id)" class="sentence-text">
            {{ s.text }}
          </div>
          <div v-else class="sentence-placeholder">
            <div class="blur-text">••••••••••••••••••••••••••••••</div>
          </div>
        </div>

        <div class="card-actions">
          <el-button 
            :type="revealedIds.has(s.id) ? 'info' : 'success'" 
            size="small" 
            @click="toggleReveal(s.id)"
          >
            {{ revealedIds.has(s.id) ? 'Hide' : 'Reveal' }}
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  sentences: {
    type: Array,
    required: true
  }
})

const activeId = ref(null)
const revealedIds = ref(new Set())
const selectedVoiceName = ref('')
const voices = ref([])

const femaleVoices = computed(() => {
  return voices.value.filter(v => 
    v.lang.startsWith('en') && 
    (v.name.toLowerCase().includes('female') || 
     v.name.toLowerCase().includes('samantha') || 
     v.name.toLowerCase().includes('victoria') ||
     v.name.toLowerCase().includes('google us english') ||
     v.name.toLowerCase().includes('microsoft zira'))
  )
})

const loadVoices = () => {
  const allVoices = window.speechSynthesis.getVoices()
  voices.value = allVoices
  if (femaleVoices.value.length > 0 && !selectedVoiceName.value) {
    selectedVoiceName.value = femaleVoices.value[0].name
  }
}

onMounted(() => {
  loadVoices()
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices
  }
})

const toggleReveal = (id) => {
  if (revealedIds.value.has(id)) {
    revealedIds.value.delete(id)
  } else {
    revealedIds.value.add(id)
  }
}

const playSentence = (s) => {
  activeId.value = s.id
  window.speechSynthesis.cancel() // Stop any current speech
  
  const utterance = new SpeechSynthesisUtterance(s.text)
  const voice = voices.value.find(v => v.name === selectedVoiceName.value)
  if (voice) {
    utterance.voice = voice
  }
  
  utterance.onend = () => {
    // Optional: auto-reveal or move to next
  }
  
  window.speechSynthesis.speak(utterance)
}
</script>

<style scoped>
.listening-bench {
  padding: 10px;
}

.bench-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.bench-header h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #303133;
}

.sentence-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sentence-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.sentence-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.sentence-card.is-active {
  border-left: 4px solid #409eff;
}

:deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.index-badge {
  width: 24px;
  height: 24px;
  background: #f0f2f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: #909399;
}

.card-content {
  flex: 1;
}

.sentence-text {
  font-size: 18px;
  color: #303133;
  line-height: 1.6;
}

.sentence-placeholder {
  height: 28px;
  display: flex;
  align-items: center;
}

.blur-text {
  background: #f0f2f5;
  color: transparent;
  width: 100%;
  border-radius: 4px;
  user-select: none;
}

.card-actions {
  display: flex;
  gap: 10px;
}
</style>
