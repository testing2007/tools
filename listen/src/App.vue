<template>
  <el-container class="layout-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo" @click="goHome" style="cursor: pointer;">
          <el-icon :size="24"><Microphone /></el-icon>
          <span>English Blind Listener</span>
        </div>
        <div class="actions">
          <el-button type="primary" @click="showUpload = true" plain>
            <el-icon><Upload /></el-icon>
            Import Audio
          </el-button>
          <el-button type="success" @click="showPdfImport = true" plain>
            <el-icon><Document /></el-icon>
            Import PDF/Text
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
        <VideoPlayer
          v-if="videoData"
          :video-url="videoData.videoUrl"
          :subtitles="videoData.subtitles"
          :subtitle-content="videoData.subtitleContent || ''"
        />

        <!-- Audio/PDF Listening Mode -->
        <ListeningBench v-else-if="sentences.length > 0" :sentences="sentences" />

        <!-- Empty State -->
        <div v-else class="empty-state">
          <el-empty description="No content imported yet">
            <div class="empty-buttons">
              <el-button type="primary" @click="showUpload = true">Import Audio</el-button>
              <el-button type="success" @click="showPdfImport = true">Import PDF/Text</el-button>
              <el-button type="warning" @click="showVideoImport = true">Import Video</el-button>
            </div>
          </el-empty>
        </div>
      </div>
    </el-main>

    <el-dialog
      v-model="showUpload"
      title="Import Audio for Analysis"
      width="500px"
      append-to-body
    >
      <AudioProcessor @processed="handleProcessed" />
    </el-dialog>

    <el-dialog
      v-model="showPdfImport"
      title="Import PDF/Text Dialogue"
      width="600px"
      append-to-body
    >
      <PdfDialogueProcessor @processed="handleProcessed" />
    </el-dialog>

    <el-dialog
      v-model="showVideoImport"
      title="Import Video with Subtitles"
      width="600px"
      append-to-body
    >
      <VideoProcessor @processed="handleVideoProcessed" />
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import { Document, VideoCamera } from '@element-plus/icons-vue'
import AudioProcessor from './components/AudioProcessor.vue'
import ListeningBench from './components/ListeningBench.vue'
import PdfDialogueProcessor from './components/PdfDialogueProcessor.vue'
import VideoProcessor from './components/VideoProcessor.vue'
import VideoPlayer from './components/VideoPlayer.vue'

const showUpload = ref(false)
const showPdfImport = ref(false)
const showVideoImport = ref(false)
const sentences = ref([])
const videoData = ref(null)

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
  background: rgba(255, 255, 255, 0.8);
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
  padding: 40px 20px;
}

.content-wrapper {
  max-width: 1000px;
  margin: 0 auto;
}

.content-wrapper-wide {
  max-width: 1400px;
  margin: 0 auto;
}

.empty-state {
  margin-top: 100px;
  background: white;
  padding: 60px;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
}

.empty-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
