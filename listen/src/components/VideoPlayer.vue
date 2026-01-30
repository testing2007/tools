<template>
  <div class="video-player-container" ref="containerEl">
    <!-- Video Section -->
    <div class="video-section" :class="{ 'has-scroll': showLyricsView || showSubtitleOverlay }">
      <div class="video-wrapper" ref="videoWrapperEl">
        <video
          ref="videoEl"
          class="main-video"
          controls
          playsinline
          webkit-playsinline
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="isPlaying = false"
          @loadedmetadata="onVideoLoaded"
          @fullscreenchange="onFullscreenChange"
          @webkitfullscreenchange="onFullscreenChange"
        >
          <source :src="videoUrl" />
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
        <div 
          v-if="showBlurMask" 
          class="subtitle-blur-mask"
          :style="{ bottom: maskBottom + 'px', height: maskHeight + 'px' }"
        ></div>
        
        <!-- Mobile overlay header (tap to show/hide) -->
        <transition name="fade">
          <div 
            v-if="showOverlayHeader && showOverlayHeaderVisible" 
            class="overlay-header"
            @click.stop
          >
            <el-button size="small" @click="emit('back')" plain>
              <el-icon><ArrowLeft /></el-icon>
              返回
            </el-button>
            <span class="overlay-title">{{ title }}</span>
          </div>
        </transition>
        
        <!-- Invisible tap area for showing overlay -->
        <div 
          v-if="showOverlayHeader"
          class="tap-area"
          @click="showOverlayHeaderVisible = !showOverlayHeaderVisible"
        ></div>
      </div>

      <!-- Subtitle Overlay (above progress bar) -->
      <transition name="fade">
        <div 
          v-if="showSubtitleOverlay" 
          class="subtitle-overlay" 
          @click="replayCurrentSentence"
          :class="{ 'can-click': !!currentSubtitleText }"
        >
          <span v-if="subtitleOverlayTextVisible && currentSubtitleText" class="subtitle-text">{{ currentSubtitleText }}</span>
          <span v-else-if="!subtitleOverlayTextVisible" class="subtitle-text subtitle-hidden">••••••••••••••••••••</span>
          <span v-else class="subtitle-text subtitle-empty">...</span>
          <el-button 
            class="overlay-toggle-btn"
            :icon="subtitleOverlayTextVisible ? View : Hide"
            circle
            size="small"
            @click.stop="subtitleOverlayTextVisible = !subtitleOverlayTextVisible"
          />
        </div>
      </transition>

      <!-- Video Controls -->
      <div class="video-controls">
        <div class="control-left">
          <el-button-group>
            <el-button size="small" @click="skipTime(-5)">
              <el-icon><DArrowLeft /></el-icon>
              <span class="hide-mobile">-5s</span>
            </el-button>
            <el-button size="small" @click="togglePlay">
              <el-icon>
                <VideoPause v-if="isPlaying" />
                <VideoPlay v-else />
              </el-icon>
            </el-button>
            <el-button size="small" @click="skipTime(5)">
              <span class="hide-mobile">+5s</span>
              <el-icon><DArrowRight /></el-icon>
            </el-button>
          </el-button-group>
        </div>

        <div class="control-right">
          <!-- Playback Mode Toggle -->
          <el-tooltip :content="singleSentenceMode ? '单句模式' : '连播模式'" placement="top">
            <el-button 
              :type="singleSentenceMode ? 'warning' : 'default'" 
              size="small"
              @click="singleSentenceMode = !singleSentenceMode"
            >
              <el-icon><component :is="singleSentenceMode ? 'Aim' : 'Refresh'" /></el-icon>
              <span class="hide-mobile">{{ singleSentenceMode ? '单句' : '连播' }}</span>
            </el-button>
          </el-tooltip>

          <!-- Blur Mask Toggle -->
          <el-tooltip content="遮罩开关" placement="top">
            <el-switch
              v-model="showBlurMask"
              active-text=""
              inactive-text=""
              size="small"
              style="margin: 0 10px;"
            />
          </el-tooltip>

          <!-- Mask Settings -->
          <el-popover placement="top" :width="250" trigger="click" v-if="showBlurMask" v-model:visible="showMaskSettings">
            <template #reference>
              <el-button size="small" circle>
                <el-icon><Setting /></el-icon>
              </el-button>
            </template>
            <div class="mask-settings">
              <p>遮罩位置调节</p>
              <div class="setting-row">
                <span>距底部:</span>
                <el-slider v-model="maskBottom" :min="0" :max="150" :step="5" />
                <span>{{ maskBottom }}px</span>
              </div>
              <div class="setting-row">
                <span>高度:</span>
                <el-slider v-model="maskHeight" :min="40" :max="200" :step="10" />
                <span>{{ maskHeight }}px</span>
              </div>
              <el-button type="primary" size="small" @click="saveMaskSettings" style="width: 100%; margin-top: 10px;">
                保存设置
              </el-button>
            </div>
          </el-popover>

          <!-- Subtitle Overlay Toggle (CC button) -->
          <el-tooltip content="字幕叠加" placement="top">
            <el-button
              :type="showSubtitleOverlay ? 'success' : 'default'"
              size="small"
              @click="showSubtitleOverlay = !showSubtitleOverlay"
              style="margin-left: 10px;"
            >
              <span style="font-weight: bold;">CC</span>
            </el-button>
          </el-tooltip>

          <!-- Lyrics View Toggle -->
          <el-tooltip content="下方精读" placement="top">
            <el-button
              :type="showLyricsView ? 'warning' : 'default'"
              size="small"
              @click="showLyricsView = !showLyricsView"
              style="margin-left: 10px;"
            >
              <el-icon><Document /></el-icon>
              <span class="hide-mobile">精读</span>
            </el-button>
          </el-tooltip>

          <!-- Subtitle Panel Toggle -->
          <el-button
            :type="showSubtitles ? 'primary' : 'default'"
            size="small"
            @click="showSubtitles = !showSubtitles"
            style="margin-left: 10px;"
          >
            <el-icon><List /></el-icon>
            <span class="hide-mobile">{{ showSubtitles ? '隐藏' : '字幕' }}</span>
          </el-button>
        </div>
      </div>

      <!-- Lyrics-style Full Text View (Below controls) -->
      <transition name="fade">
        <div v-if="showLyricsView" class="lyrics-view-container">
          <div class="lyrics-list" ref="lyricsListEl">
            <div 
              v-for="sub in subtitles" 
              :key="'lyrics-'+sub.id"
              class="lyrics-line"
              :class="{ 'is-active': currentSubtitleId === sub.id }"
              @click="seekToSubtitle(sub)"
            >
              {{ sub.text }}
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Subtitle Panel (collapsible) -->
    <transition name="slide">
      <div v-show="showSubtitles" class="subtitle-panel">
        <div class="panel-header">
          <h3><el-icon><Document /></el-icon> 字幕</h3>
          <div class="panel-actions">
            <el-radio-group v-model="subtitleViewMode" size="small" style="margin-right: 10px;">
              <el-radio-button label="list">列表</el-radio-button>
              <el-radio-button label="full">精读</el-radio-button>
            </el-radio-group>
            <el-checkbox v-model="autoReveal" size="small">显示全部</el-checkbox>
          </div>
        </div>

        <div class="subtitle-list" ref="subtitleListEl" :class="subtitleViewMode">
          <!-- List View Mode (Default) -->
          <template v-if="subtitleViewMode === 'list'">
            <div
              v-for="(sub, index) in subtitles"
              :key="sub.id"
              class="subtitle-item"
              :class="{
                'is-active': singleSentenceMode ? (currentPlayingSubId === sub.id) : (currentSubtitleId === sub.id),
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
          </template>

          <!-- Full View Mode (Simple List of lines) -->
          <template v-else>
            <div 
              v-for="(sub, index) in subtitles" 
              :key="'full-'+sub.id"
              class="full-view-line"
              :class="{
                'is-active': singleSentenceMode ? (currentPlayingSubId === sub.id) : (currentSubtitleId === sub.id),
                'is-revealed': autoReveal || revealedIds.has(sub.id)
              }"
              @click="seekToSubtitle(sub)"
            >
              <template v-if="autoReveal || revealedIds.has(sub.id)">
                <span class="line-text">{{ sub.text }}</span>
              </template>
              <template v-else>
                <span class="blur-text">••••••••••••••••••••••••••••••••••••</span>
              </template>
            </div>
          </template>
        </div>
      </div>
    </transition>

    <!-- Fullscreen Blur Mask (for native fullscreen) -->
    <teleport to="body">
      <div 
        v-if="showBlurMask && isFullscreen" 
        class="fullscreen-blur-mask"
        :style="{ bottom: maskBottom + 'px', height: maskHeight + 'px' }"
      ></div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { 
  VideoPlay, VideoPause, DArrowLeft, DArrowRight, 
  List, Document, View, Hide, Setting, Aim, Refresh, ArrowLeft
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
  },
  title: {
    type: String,
    default: ''
  },
  showOverlayHeader: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['back'])

const containerEl = ref(null)
const videoWrapperEl = ref(null)
const videoEl = ref(null)
const subtitleListEl = ref(null)
const subtitleTrack = ref(null)
const isPlaying = ref(false)
const isFullscreen = ref(false)
const currentTime = ref(0)
const showSubtitles = ref(false)
const showVideoSubtitle = ref(false)
const showBlurMask = ref(true)
const autoReveal = ref(false)
const revealedIds = ref(new Set())
const subtitleTrackUrl = ref('')
const singleSentenceMode = ref(false)  // Single sentence mode
const currentPlayingSubId = ref(null)  // Track which subtitle is being played
const showOverlayHeaderVisible = ref(false)  // For mobile overlay header tap-to-show
const showSubtitleOverlay = ref(false)  // Subtitle overlay above progress bar (default off)
const subtitleOverlayTextVisible = ref(true)  // Whether to show text in subtitle overlay
const subtitleViewMode = ref('list')  // 'list' or 'full' view modes
const showLyricsView = ref(true)  // Show full text below video
const lyricsListEl = ref(null)    // Ref for the lyrics container

// Mask settings with localStorage persistence
const showMaskSettings = ref(false)
const maskBottom = ref(parseInt(localStorage.getItem('mask_bottom') || '45'))  // Above video controls
const maskHeight = ref(parseInt(localStorage.getItem('mask_height') || '70'))

const currentSubtitleId = computed(() => {
  const time = currentTime.value
  const sub = props.subtitles.find(s => time >= s.startTime && time <= s.endTime)
  return sub ? sub.id : null
})

// Current subtitle text for overlay display
const currentSubtitleText = computed(() => {
  const time = currentTime.value
  const sub = props.subtitles.find(s => time >= s.startTime && time <= s.endTime)
  return sub ? sub.text : ''
})

const replayCurrentSentence = () => {
  if (!videoEl.value) return
  const time = videoEl.value.currentTime
  const sub = props.subtitles.find(s => time >= s.startTime && time <= s.endTime)
  if (sub) {
    videoEl.value.currentTime = sub.startTime
    videoEl.value.play()
  }
}

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const convertSRTtoVTT = (srtContent) => {
  if (!srtContent) return ''
  
  let vtt = 'WEBVTT\n\n'
  const blocks = srtContent.trim().split(/\n\n+/)
  
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 2) continue
    
    let timeLineIdx = 0
    if (!/-->/.test(lines[0])) timeLineIdx = 1
    if (timeLineIdx >= lines.length) continue
    
    const timeLine = lines[timeLineIdx]
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
    
    // Single sentence mode: pause at end of current subtitle
    // Keep currentPlayingSubId so the highlight remains
    if (singleSentenceMode.value && currentPlayingSubId.value) {
      const sub = props.subtitles.find(s => s.id === currentPlayingSubId.value)
      if (sub && currentTime.value >= sub.endTime) {
        videoEl.value.pause()
        // Do NOT clear currentPlayingSubId - keep highlight for replay
      }
    }
  }
}

const onFullscreenChange = () => {
  isFullscreen.value = !!(
    document.fullscreenElement || 
    document.webkitFullscreenElement ||
    document.mozFullScreenElement
  )
}

const togglePlay = () => {
  if (!videoEl.value) return
  if (isPlaying.value) {
    videoEl.value.pause()
  } else {
    // In single sentence mode, if we have a selected subtitle and video is paused at/past its end,
    // seek back to the start of that subtitle for replay
    if (singleSentenceMode.value && currentPlayingSubId.value) {
      const sub = props.subtitles.find(s => s.id === currentPlayingSubId.value)
      if (sub && videoEl.value.currentTime >= sub.endTime) {
        videoEl.value.currentTime = sub.startTime
      }
    }
    isOurPlayAction.value = true  // Mark that this is our button, not native controls
    videoEl.value.play()
  }
}

// Track if play was triggered by our button (true) or native controls (false)
const isOurPlayAction = ref(false)

const onPlay = () => {
  isPlaying.value = true
  
  // For native controls: follow current mode setting
  if (!isOurPlayAction.value && singleSentenceMode.value) {
    // In single sentence mode, set currentPlayingSubId to current subtitle based on time
    // This enables proper pause at subtitle end and blue highlight
    const currentSub = props.subtitles.find(s => 
      videoEl.value.currentTime >= s.startTime && videoEl.value.currentTime <= s.endTime
    )
    if (currentSub) {
      currentPlayingSubId.value = currentSub.id
    } else {
      // If between subtitles, find the next subtitle
      const nextSub = props.subtitles.find(s => videoEl.value.currentTime < s.startTime)
      if (nextSub) {
        currentPlayingSubId.value = nextSub.id
      }
    }
  }
  isOurPlayAction.value = false  // Reset for next play action
}

const skipTime = (seconds) => {
  if (videoEl.value) {
    videoEl.value.currentTime += seconds
  }
}

const seekToSubtitle = (sub) => {
  if (!videoEl.value || !sub) return
  
  const startTime = parseFloat(sub.startTime) || 0
  console.log('[VideoPlayer] Seeking to subtitle:', sub.id, 'time:', startTime)
  
  // Set the target subtitle for single sentence mode
  if (singleSentenceMode.value) {
    currentPlayingSubId.value = sub.id
  } else {
    currentPlayingSubId.value = null
  }
  
  // Use seeked event to ensure seek completes before playing
  const onSeeked = () => {
    videoEl.value.removeEventListener('seeked', onSeeked)
    isOurPlayAction.value = true  // Mark as our action to prevent onPlay from overwriting
    videoEl.value.play().catch(e => console.log('Play error:', e))
  }
  
  videoEl.value.addEventListener('seeked', onSeeked)
  videoEl.value.currentTime = startTime
}

const toggleReveal = (id) => {
  if (revealedIds.value.has(id)) {
    revealedIds.value.delete(id)
  } else {
    revealedIds.value.add(id)
  }
  revealedIds.value = new Set(revealedIds.value)
}

const saveMaskSettings = () => {
  localStorage.setItem('mask_bottom', maskBottom.value.toString())
  localStorage.setItem('mask_height', maskHeight.value.toString())
  showMaskSettings.value = false  // Close popover
}

// Auto-scroll logic for Lyrics View
watch(currentSubtitleId, async (newId) => {
  if (newId && showLyricsView.value && lyricsListEl.value) {
    await nextTick()
    const activeItem = lyricsListEl.value.querySelector('.lyrics-line.is-active')
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }
})

// When switching to single sentence mode, immediately activate current subtitle
watch(singleSentenceMode, (newVal) => {
  if (newVal && currentSubtitleId.value) {
    // Immediately set the current playing subtitle to the one being played
    currentPlayingSubId.value = currentSubtitleId.value
  } else if (!newVal) {
    // When switching to continuous mode:
    // 1. Clear the single sentence lock
    const lastPlayedId = currentPlayingSubId.value
    currentPlayingSubId.value = null
    
    // 2. If video is paused and we have a last played subtitle, seek to next and play
    if (videoEl.value && videoEl.value.paused && lastPlayedId) {
      const currentIndex = props.subtitles.findIndex(s => s.id === lastPlayedId)
      const nextSub = props.subtitles[currentIndex + 1]
      
      if (nextSub) {
        // Seek to next subtitle and play
        videoEl.value.currentTime = nextSub.startTime
        videoEl.value.play().catch(e => console.log('Play error:', e))
      }
      // If no next subtitle (last one), just stay where we are
    }
  }
})

// Listen for fullscreen changes
onMounted(() => {
  createSubtitleTrack()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
})

onUnmounted(() => {
  if (subtitleTrackUrl.value) {
    URL.revokeObjectURL(subtitleTrackUrl.value)
  }
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
})
</script>

<style scoped>
.video-player-container {
  display: flex;
  gap: 20px;
  width: 100%;
  flex: 1;
  min-height: 0;  /* Important for flex child to shrink */
}

.video-section {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.video-wrapper {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  max-height: calc(100vh - 180px);  /* Leave room for header and controls */
  transition: all 0.3s ease;
}

.main-video {
  width: 100%;
  max-height: calc(100vh - 180px);  /* Match wrapper constraint */
  display: block;
}

/* When lyrics view or CC overlay is active, allow scrolling and prevent shrinking */
.video-section.has-scroll {
  overflow-y: auto !important;
  display: block !important; /* Switch from flex to block to allow scrolling */
  padding-bottom: 20px;
}

.video-section.has-scroll .video-wrapper {
  flex-shrink: 0;
  max-height: none !important; /* Remove constraints */
  min-height: 480px; /* Ensure video stays large enough */
}

.video-section.has-scroll .main-video {
  max-height: 60vh; /* Limit video height so it doesn't take too much space */
}

/* Blur mask to hide hard-coded subtitles */
.subtitle-blur-mask {
  position: absolute;
  left: 0;
  right: 0;
  background: linear-gradient(to bottom, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.8) 40%,
    rgba(0, 0, 0, 1) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  pointer-events: none;
  z-index: 10;
}

/* Fullscreen blur mask */
.fullscreen-blur-mask {
  position: fixed;
  left: 0;
  right: 0;
  background: linear-gradient(to bottom, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.8) 40%,
    rgba(0, 0, 0, 1) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  pointer-events: none;
  z-index: 2147483647;
}

/* Subtitle Overlay above progress bar */
.subtitle-overlay {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 40px; /* Extra padding for the toggle button */
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 10px;
  min-height: 50px;
}

.subtitle-overlay .subtitle-text {
  color: #fff;
  font-size: 18px;
  font-weight: 500;
  text-align: center;
  line-height: 1.5;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  word-break: break-word;
}

.subtitle-overlay .subtitle-hidden {
  opacity: 0.6;
  letter-spacing: 2px;
}

.subtitle-overlay .subtitle-empty {
  font-style: italic;
  opacity: 0.5;
}

.subtitle-overlay.can-click {
  cursor: pointer;
}

.subtitle-overlay.can-click:hover {
  background: rgba(0, 0, 0, 0.85);
}

.overlay-toggle-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(255, 255, 255, 0.1) !important;
  border: none !important;
  color: #fff !important;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.overlay-toggle-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2) !important;
}

.video-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;  /* Prevent controls from being hidden */
}

/* Lyrics View below controls */
.lyrics-view-container {
  margin-top: 15px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  height: 400px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);
}

.lyrics-list {
  height: 100%;
  overflow-y: auto;
  padding: 160px 0; /* Add padding to top/bottom to allow centering first/last lines */
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lyrics-list::-webkit-scrollbar {
  width: 6px;
}
.lyrics-list::-webkit-scrollbar-thumb {
  background: #f0f0f0;
  border-radius: 3px;
}

.lyrics-line {
  font-size: 18px;
  line-height: 1.6;
  color: #909399;
  padding: 10px 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.5;
  filter: blur(0.5px);
}

.lyrics-line:hover {
  color: #606266;
  opacity: 0.8;
  filter: blur(0);
}

.lyrics-line.is-active {
  color: #409eff;
  font-size: 24px;
  font-weight: bold;
  opacity: 1;
  filter: blur(0);
  transform: scale(1.05);
  text-shadow: 0 2px 15px rgba(64, 158, 255, 0.15);
}

.control-left, .control-right {
  display: flex;
  align-items: center;
  gap: 5px;
}

.mask-settings {
  padding: 10px;
}

.mask-settings p {
  margin: 0 0 10px 0;
  font-weight: bold;
  color: #303133;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.setting-row span:first-child {
  width: 50px;
  flex-shrink: 0;
}

.setting-row .el-slider {
  flex: 1;
}

.setting-row span:last-child {
  width: 50px;
  text-align: right;
  color: #909399;
  font-size: 12px;
}

/* Subtitle Panel */
.subtitle-panel {
  width: 320px;
  flex-shrink: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);  /* Enable scrollbar by constraining height */
  overflow: hidden;
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
  display: flex;
  align-items: center;
  margin-left: 8px;
  flex-shrink: 0;
}

/* Full View Specific Styles */
.subtitle-list.full {
  padding: 15px;
}

.full-view-line {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  line-height: 1.6;
  font-size: 15px;
  color: #303133;
}

.full-view-line:hover {
  background: #f5f7fa;
}

.full-view-line.is-active {
  background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.full-view-line.is-active .line-text {
  font-weight: 500;
}

.full-view-line .blur-text {
  opacity: 0.5;
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

/* Mobile Styles */
@media (max-width: 768px) {
  .video-player-container {
    flex-direction: column;
    gap: 10px;
  }

  .video-section {
    width: 100%;
  }
  
  .video-wrapper {
    border-radius: 8px;
  }

  .subtitle-panel {
    width: 100%;
    max-height: 40vh;
    border-radius: 8px;
  }
  
  .panel-header {
    padding: 10px 15px;
  }
  
  .panel-header h3 {
    font-size: 14px;
  }
  
  .subtitle-list {
    padding: 8px;
  }
  
  .subtitle-item {
    padding: 10px 12px;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .sub-left {
    min-width: 40px;
  }
  
  .sub-index {
    font-size: 11px;
  }
  
  .sub-time {
    font-size: 10px;
  }
  
  .sub-content {
    font-size: 13px;
  }
  
  .hide-mobile {
    display: none !important;
  }
  
  /* Compact video controls for mobile */
  .video-controls {
    padding: 6px 8px;
    margin-top: 8px;
    gap: 5px;
    border-radius: 8px;
  }
  
  .control-left,
  .control-right {
    gap: 4px;
  }
  
  .control-left .el-button,
  .control-right .el-button {
    padding: 6px 10px;
    min-width: 32px;
  }
  
  .control-right .el-switch {
    margin: 0 5px !important;
  }
  
  .control-right .el-button[style*="margin-left"] {
    margin-left: 5px !important;
  }
}

/* Extra small screens */
@media (max-width: 480px) {
  .video-controls {
    padding: 5px 6px;
  }
  
  .control-left .el-button,
  .control-right .el-button {
    padding: 5px 8px;
    min-width: 28px;
  }
  
  .subtitle-panel {
    max-height: 35vh;
  }
  
  .subtitle-item {
    padding: 8px 10px;
  }
}

/* Landscape mode - maximize video */
@media (orientation: landscape) and (max-height: 500px) {
  .video-player-container {
    flex-direction: row;
  }
  
  .video-section {
    flex: 2;
  }
  
  .subtitle-panel {
    width: 280px;
    max-height: 100%;
  }
  
  .subtitle-blur-mask {
    height: 50px !important;
    bottom: 25px !important;
  }
  
  .video-controls {
    padding: 4px 8px;
    margin-top: 5px;
  }
}

/* Mobile portrait mode - vertical layout with maximized subtitle panel */
@media (max-width: 768px) and (orientation: portrait) {
  .video-player-container {
    flex-direction: column;
    gap: 5px;
    height: 100%;
  }
  
  .video-section {
    flex: none;  /* Don't grow - let subtitle panel take remaining space */
  }
  
  .video-wrapper {
    max-height: 28vh;
    border-radius: 8px;
  }
  
  .main-video {
    max-height: 28vh;
  }
  
  .video-controls {
    margin-top: 5px;
    padding: 4px 8px;
  }
  
  .subtitle-panel {
    width: 100%;
    flex: 1;
    min-height: 0;
    max-height: none !important;
    border-radius: 8px;
  }
  
  .subtitle-list {
    flex: 1;
    overflow-y: auto;
  }
  
  .panel-header {
    padding: 10px 15px;
    flex-shrink: 0;
  }
}

/* Overlay header styles */
.overlay-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 10px 15px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 100;
}

.overlay-title {
  color: white;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tap-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 50;
  cursor: pointer;
}

/* Fade transition for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
