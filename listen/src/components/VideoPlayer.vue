<template>
  <div class="video-player-container">
    <!-- Video Section -->
    <div class="video-section">
      <div class="video-wrapper">
        <video
          ref="videoEl"
          class="main-video"
          controls
          @timeupdate="onTimeUpdate"
          @play="isPlaying = true"
          @pause="isPlaying = false"
          @loadedmetadata="onVideoLoaded"
        >
          <source :src="videoUrl" />
          <!-- Dynamic subtitle track -->
          <track
            v-if="subtitleTrackUrl"
            ref="subtitleTrack"
            kind="subtitles"
            label="English"
            srclang="en"
            :src="subtitleTrackUrl"
            :default="showVideoSubtitle"
          />
        </video>
        <!-- Blur mask overlay for hard-coded subtitles -->
        <div v-if="showBlurMask" class="subtitle-blur-mask"></div>
      </div>

      <div class="video-controls">
        <el-button-group>
          <el-button size="small" @click="skipTime(-5)">
            <el-icon><DArrowLeft /></el-icon> -5s
          </el-button>
          <el-button size="small" @click="togglePlay">
            <el-icon>
              <VideoPause v-if="isPlaying" />
              <VideoPlay v-else />
            </el-icon>
          </el-button>
          <el-button size="small" @click="skipTime(5)">
            +5s <el-icon><DArrowRight /></el-icon>
          </el-button>
        </el-button-group>

        <div class="control-right">
          <!-- Blur Mask Toggle -->
          <el-tooltip content="模糊遮罩 (隐藏硬字幕)" placement="top">
            <el-switch
              v-model="showBlurMask"
              active-text="遮罩"
              inactive-text=""
              style="margin-right: 15px;"
            />
          </el-tooltip>

          <!-- Video Subtitle Toggle -->
          <el-tooltip content="视频字幕开关" placement="top">
            <el-switch
              v-model="showVideoSubtitle"
              active-text="字幕"
              inactive-text=""
              style="margin-right: 15px;"
              @change="toggleVideoSubtitle"
            />
          </el-tooltip>

          <!-- Subtitle Panel Toggle -->
          <el-button
            :type="showSubtitles ? 'primary' : 'default'"
            size="small"
            @click="showSubtitles = !showSubtitles"
          >
            <el-icon><List /></el-icon>
            {{ showSubtitles ? '隐藏列表' : '字幕列表' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- Subtitle Panel (collapsible) -->
    <transition name="slide">
      <div v-show="showSubtitles" class="subtitle-panel">
        <div class="panel-header">
          <h3><el-icon><Document /></el-icon> 字幕列表</h3>
          <div class="panel-actions">
            <el-checkbox v-model="autoReveal" size="small">显示全部</el-checkbox>
          </div>
        </div>

        <div class="subtitle-list" ref="subtitleListEl">
          <div
            v-for="(sub, index) in subtitles"
            :key="sub.id"
            class="subtitle-item"
            :class="{
              'is-active': currentSubtitleId === sub.id,
              'is-revealed': autoReveal || revealedIds.has(sub.id)
            }"
            @click="seekToSubtitle(sub)"
          >
            <div class="sub-left">
              <span class="sub-index">{{ index + 1 }}</span>
              <span class="sub-time">{{ formatTime(sub.startTime) }}</span>
            </div>

            <div class="sub-content">
              <template v-if="autoReveal || revealedIds.has(sub.id)">
                {{ sub.text }}
              </template>
              <template v-else>
                <span class="blur-text">•••••••••••••••••••••</span>
              </template>
            </div>

            <div class="sub-actions" @click.stop>
              <el-button
                v-if="!autoReveal"
                :type="revealedIds.has(sub.id) ? 'info' : 'success'"
                size="small"
                circle
                @click="toggleReveal(sub.id)"
              >
                <el-icon>
                  <View v-if="!revealedIds.has(sub.id)" />
                  <Hide v-else />
                </el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { 
  VideoPlay, VideoPause, DArrowLeft, DArrowRight, 
  List, Document, View, Hide 
} from '@element-plus/icons-vue'

const props = defineProps({
  videoUrl: {
    type: String,
    required: true
  },
  subtitles: {
    type: Array,
    required: true
  },
  subtitleContent: {
    type: String,
    default: ''
  }
})

const videoEl = ref(null)
const subtitleListEl = ref(null)
const subtitleTrack = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const showSubtitles = ref(false)
const showVideoSubtitle = ref(false)  // Video subtitle OFF by default
const showBlurMask = ref(true)  // Blur mask ON by default to hide hard-coded subtitles
const autoReveal = ref(false)
const revealedIds = ref(new Set())
const subtitleTrackUrl = ref('')

const currentSubtitleId = computed(() => {
  const time = currentTime.value
  const sub = props.subtitles.find(s => time >= s.startTime && time <= s.endTime)
  return sub ? sub.id : null
})

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Convert SRT content to VTT format for <track> element
const convertSRTtoVTT = (srtContent) => {
  if (!srtContent) return ''
  
  let vtt = 'WEBVTT\n\n'
  const blocks = srtContent.trim().split(/\n\n+/)
  
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 2) continue
    
    // Find time line
    let timeLineIdx = 0
    if (!/-->/.test(lines[0])) timeLineIdx = 1
    if (timeLineIdx >= lines.length) continue
    
    const timeLine = lines[timeLineIdx]
    // Convert comma to dot for VTT format
    const vttTimeLine = timeLine.replace(/,/g, '.')
    
    const text = lines.slice(timeLineIdx + 1).join('\n')
    
    if (text.trim()) {
      vtt += `${vttTimeLine}\n${text}\n\n`
    }
  }
  
  return vtt
}

const createSubtitleTrack = () => {
  if (!props.subtitleContent) return
  
  const vttContent = convertSRTtoVTT(props.subtitleContent)
  if (!vttContent) return
  
  const blob = new Blob([vttContent], { type: 'text/vtt' })
  subtitleTrackUrl.value = URL.createObjectURL(blob)
}

const onVideoLoaded = () => {
  // Initialize text track state
  toggleVideoSubtitle(showVideoSubtitle.value)
}

const toggleVideoSubtitle = (show) => {
  if (!videoEl.value) return
  
  const tracks = videoEl.value.textTracks
  if (tracks && tracks.length > 0) {
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = show ? 'showing' : 'hidden'
    }
  }
}

const onTimeUpdate = () => {
  if (videoEl.value) {
    currentTime.value = videoEl.value.currentTime
  }
}

const togglePlay = () => {
  if (!videoEl.value) return
  if (isPlaying.value) {
    videoEl.value.pause()
  } else {
    videoEl.value.play()
  }
}

const skipTime = (seconds) => {
  if (videoEl.value) {
    videoEl.value.currentTime += seconds
  }
}

const seekToSubtitle = (sub) => {
  if (!videoEl.value) return
  videoEl.value.currentTime = sub.startTime
  videoEl.value.play()
}

const toggleReveal = (id) => {
  if (revealedIds.value.has(id)) {
    revealedIds.value.delete(id)
  } else {
    revealedIds.value.add(id)
  }
  // Force reactivity
  revealedIds.value = new Set(revealedIds.value)
}

// Auto-scroll to current subtitle
watch(currentSubtitleId, async (id) => {
  if (!id || !subtitleListEl.value) return
  
  await nextTick()
  const activeEl = subtitleListEl.value.querySelector('.is-active')
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

onMounted(() => {
  createSubtitleTrack()
})

onUnmounted(() => {
  if (subtitleTrackUrl.value) {
    URL.revokeObjectURL(subtitleTrackUrl.value)
  }
})
</script>

<style scoped>
.video-player-container {
  display: flex;
  gap: 20px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.video-section {
  flex: 1;
  min-width: 0;
}

.video-wrapper {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.main-video {
  width: 100%;
  display: block;
}

/* Blur mask to hide hard-coded subtitles */
.subtitle-blur-mask {
  position: absolute;
  bottom: 40px;  /* Above video controls */
  left: 0;
  right: 0;
  height: 80px;  /* Height of blur area */
  background: linear-gradient(to bottom, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.7) 30%,
    rgba(0, 0, 0, 0.9) 100%
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;  /* Allow clicking through */
  z-index: 10;
}

/* Style video subtitles */
.main-video::cue {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 18px;
  padding: 5px 10px;
  border-radius: 4px;
}

.video-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.control-right {
  display: flex;
  align-items: center;
}

/* Subtitle Panel */
.subtitle-panel {
  width: 380px;
  flex-shrink: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.panel-header {
  padding: 15px 20px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.subtitle-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.subtitle-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 8px;
  background: #fafafa;
}

.subtitle-item:hover {
  background: #ecf5ff;
  transform: translateX(3px);
}

.subtitle-item.is-active {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.subtitle-item.is-active .sub-time,
.subtitle-item.is-active .sub-index {
  color: rgba(255, 255, 255, 0.9);
}

.sub-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 50px;
}

.sub-index {
  font-size: 12px;
  font-weight: bold;
  color: #909399;
}

.sub-time {
  font-size: 11px;
  color: #c0c4cc;
  font-family: monospace;
}

.sub-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
}

.blur-text {
  background: linear-gradient(90deg, #e0e0e0 0%, #f0f0f0 50%, #e0e0e0 100%);
  color: transparent;
  border-radius: 4px;
  display: inline-block;
  user-select: none;
}

.sub-actions {
  flex-shrink: 0;
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Responsive */
@media (max-width: 900px) {
  .video-player-container {
    flex-direction: column;
  }

  .subtitle-panel {
    width: 100%;
    max-height: 50vh;
  }
}
</style>
