<template>
  <el-container class="layout-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
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
        </div>
      </div>
    </el-header>

    <el-main class="main-content">
      <div class="content-wrapper">
        <ListeningBench v-if="sentences.length > 0" :sentences="sentences" />
        <div v-else class="empty-state">
          <el-empty description="No content imported yet">
            <div class="empty-buttons">
              <el-button type="primary" @click="showUpload = true">Import Audio</el-button>
              <el-button type="success" @click="showPdfImport = true">Import PDF/Text</el-button>
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
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import { Document } from '@element-plus/icons-vue'
import AudioProcessor from './components/AudioProcessor.vue'
import ListeningBench from './components/ListeningBench.vue'
import PdfDialogueProcessor from './components/PdfDialogueProcessor.vue'

const showUpload = ref(false)
const showPdfImport = ref(false)
const sentences = ref([])

const handleProcessed = (data) => {
  sentences.value = data
  showUpload.value = false
  showPdfImport.value = false
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
  max-width: 1200px;
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

.empty-state {
  margin-top: 100px;
  background: white;
  padding: 60px;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
}
</style>
