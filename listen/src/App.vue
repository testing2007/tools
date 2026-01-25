<template>
  <el-container class="layout-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo" @click="goHome" style="cursor: pointer;">
          <el-icon :size="24"><Microphone /></el-icon>
          <span class="logo-text">English Blind Listener</span>
        </div>
        <div class="actions desktop-only">
          <el-button type="primary" @click="showUpload = true" plain>
            <el-icon><Upload /></el-icon>
            Import Audio
          </el-button>
          <el-button type="success" @click="showPdfImport = true" plain>
            <el-icon><Document /></el-icon>
            Import PDF
          </el-button>
          <el-button type="warning" @click="showVideoImport = true" plain>
            <el-icon><VideoCamera /></el-icon>
            Import Video
          </el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main-content">
      <div :class="videoData ? 'content-wrapper-wide' : 'content-wrapper'">
        <!-- Video Player Mode -->
        <div v-if="videoData" class="player-container">
          <div class="player-header">
            <el-button @click="goHome" size="small" plain>
              <el-icon><ArrowLeft /></el-icon>
              返回列表
            </el-button>
            <span class="current-title">{{ videoData.title || '正在播放' }}</span>
          </div>
          <VideoPlayer
            :video-url="videoData.videoUrl"
            :subtitles="videoData.subtitles"
            :subtitle-content="videoData.subtitleContent || ''"
          />
        </div>

        <!-- Audio/PDF Listening Mode -->
        <ListeningBench v-else-if="sentences.length > 0" :sentences="sentences" />

        <!-- Video Library (default view) -->
        <VideoLibrary v-else @select="handleVideoSelect" />
      </div>
    </el-main>

    <!-- Mobile Bottom Nav -->
    <div class="mobile-nav mobile-only">
      <div class="nav-item" @click="showUpload = true">
        <el-icon><Microphone /></el-icon>
        <span>音频</span>
      </div>
      <div class="nav-item" @click="showPdfImport = true">
        <el-icon><Document /></el-icon>
        <span>PDF</span>
      </div>
      <div class="nav-item active" @click="goHome">
        <el-icon><Film /></el-icon>
        <span>视频</span>
      </div>
    </div>

    <el-dialog
      v-model="showUpload"
      title="Import Audio for Analysis"
      :width="isMobile ? '95%' : '500px'"
      append-to-body
    >
      <AudioProcessor @processed="handleProcessed" />
    </el-dialog>

    <el-dialog
      v-model="showPdfImport"
      title="Import PDF/Text Dialogue"
      :width="isMobile ? '95%' : '600px'"
      append-to-body
    >
      <PdfDialogueProcessor @processed="handleProcessed" />
    </el-dialog>

    <el-dialog
      v-model="showVideoImport"
      title="Import Video with Subtitles"
      :width="isMobile ? '95%' : '600px'"
      append-to-body
    >
      <VideoProcessor @processed="handleVideoProcessed" />
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Document, VideoCamera, ArrowLeft, Film } from '@element-plus/icons-vue'
import AudioProcessor from './components/AudioProcessor.vue'
import ListeningBench from './components/ListeningBench.vue'
import PdfDialogueProcessor from './components/PdfDialogueProcessor.vue'
import VideoProcessor from './components/VideoProcessor.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import VideoLibrary from './components/VideoLibrary.vue'

const showUpload = ref(false)
const showPdfImport = ref(false)
const showVideoImport = ref(false)
const sentences = ref([])
const videoData = ref(null)

const isMobile = computed(() => window.innerWidth < 768)

const handleProcessed = (data) => {
  sentences.value = data
  videoData.value = null
  showUpload.value = false
  showPdfImport.value = false
}

const handleVideoProcessed = (data) => {
  videoData.value = data
  sentences.value = []
  showVideoImport.value = false
}

const handleVideoSelect = (data) => {
  videoData.value = data
  sentences.value = []
}

const goHome = () => {
  sentences.value = []
  videoData.value = null
}
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.app-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: bold;
  color: #409eff;
}

.main-content {
  padding: 20px;
  padding-bottom: 80px; /* Space for mobile nav */
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
}

.content-wrapper-wide {
  max-width: 1400px;
  margin: 0 auto;
}

.player-container {
  width: 100%;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.current-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* Mobile Bottom Nav */
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);
  z-index: 200;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 20px;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
}

.nav-item.active {
  color: #409eff;
}

.nav-item .el-icon {
  font-size: 20px;
}

/* Responsive */
.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
  
  .mobile-only {
    display: flex !important;
  }
  
  .logo-text {
    display: none;
  }
  
  .main-content {
    padding: 15px;
    padding-bottom: 90px;
  }
  
  .player-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
