<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>详情页编辑器</h1>
        <p>生成 1000px 宽的产品详情页</p>
      </div>

      <div class="sidebar-body">
        <!-- 产品描述输入 -->
        <div class="form-section">
          <label>产品描述</label>
          <el-input
            v-model="productDescription"
            type="textarea"
            :rows="4"
            placeholder="例如：波尔多法布朗红酒，醇厚口感..."
          />
          <el-button type="primary" class="full-width" @click="generateContent" :loading="generating">
            ✨ AI 生成文案
          </el-button>
        </div>

        <!-- 上传产品图 -->
        <div class="form-section">
          <label>上传产品图</label>
          <el-upload
            class="upload-area"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleImageUpload"
            :show-file-list="false"
          >
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-text">点击或拖拽上传</div>
          </el-upload>
        </div>

        <!-- 导出按钮 -->
        <div class="form-section">
          <el-button type="success" class="full-width" size="large" @click="exportImage">
            📥 导出详情页图片
          </el-button>
        </div>
      </div>
    </aside>

    <!-- 主内容区：详情页预览 -->
    <main class="main-content">
      <div class="preview-header">
        <el-tag type="info">预览区域 (宽度 1000px)</el-tag>
      </div>

      <!-- 这是要导出的详情页内容 -->
      <div ref="detailPageRef" class="detail-page">
        <!-- Section 1: Hero Banner -->
        <section class="section hero-section">
          <img :src="images.hero" class="section-bg" alt="hero" />
          <div class="hero-overlay">
            <div class="product-image-slot" @click="triggerUpload">
              <img v-if="productImage" :src="productImage" class="product-img" />
              <div v-else class="placeholder">
                <el-icon><Picture /></el-icon>
                <span>点击上传产品图</span>
              </div>
            </div>
            <h2 class="hero-title">{{ content.title }}</h2>
          </div>
          <button class="save-section-btn" @click="saveSection('hero')">保存此区块</button>
        </section>

        <!-- Section 2: 产品介绍 -->
        <section class="section intro-section">
          <div class="intro-left">
            <img :src="images.origin" class="intro-image" alt="origin" />
          </div>
          <div class="intro-right">
            <h3>产品亮点</h3>
            <p class="intro-text">{{ content.description }}</p>
          </div>
          <button class="save-section-btn" @click="saveSection('intro')">保存此区块</button>
        </section>

        <!-- Section 3: 搭配建议 -->
        <section class="section pairing-section">
          <img :src="images.pairing" class="section-bg" alt="pairing" />
          <div class="pairing-overlay">
            <h3>搭配建议</h3>
            <p>{{ content.pairing }}</p>
          </div>
          <button class="save-section-btn" @click="saveSection('pairing')">保存此区块</button>
        </section>

        <!-- Section 4: 底部 -->
        <section class="section footer-section">
          <p>{{ content.footer }}</p>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'

// 模板图片路径 - 使用 public 目录下的静态资源
const images = {
  hero: '/template/hero_v2.png',
  origin: '/template/origin_v2.png',
  pairing: '/template/pairing_v2.png',
  alcohol: '/template/alcohol_v2.png',
  flavor: '/template/flavor_v2.png'
}

// 产品图片
const productImage = ref('')

// 产品描述输入
const productDescription = ref('')

// 生成状态
const generating = ref(false)

// 详情页内容 - 模拟数据
const content = reactive({
  title: '法布朗庄园干红葡萄酒',
  description: '源自波尔多核心产区，传承百年酿造工艺。\n\n精选优质葡萄，橡木桶陈酿18个月，带来层次丰富的果香与细腻单宁。',
  pairing: '适合搭配牛排、羊排等红肉，或与成熟奶酪一同享用。',
  footer: '精品生活 · 品质之选'
})

// 详情页 DOM 引用
const detailPageRef = ref(null)

// 处理图片上传
function handleImageUpload(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    productImage.value = e.target.result
    ElMessage.success('产品图上传成功')
  }
  reader.readAsDataURL(file.raw)
}

// 触发上传
function triggerUpload() {
  document.querySelector('.upload-area input[type="file"]')?.click()
}

// AI 生成文案 (模拟)
async function generateContent() {
  if (!productDescription.value.trim()) {
    ElMessage.warning('请先输入产品描述')
    return
  }

  generating.value = true
  
  // 模拟 AI 生成延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const keyword = productDescription.value
  content.title = `${keyword} · 经典之选`
  content.description = `这是一款独具魅力的产品。\n\n${keyword}，采用精选原料，经过严格工艺打造，带给您非凡的体验。`
  content.pairing = `适合各种场合，无论是日常享用还是特殊时刻，都是理想之选。`
  content.footer = '品质保证 · 值得信赖'
  
  generating.value = false
  ElMessage.success('文案生成成功')
}

// 导出整个详情页
async function exportImage() {
  if (!detailPageRef.value) return
  
  try {
    const canvas = await html2canvas(detailPageRef.value, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })
    
    const link = document.createElement('a')
    link.download = 'product-detail.jpg'
    link.href = canvas.toDataURL('image/jpeg', 0.9)
    link.click()
    
    ElMessage.success('详情页导出成功')
  } catch (err) {
    console.error('Export failed:', err)
    ElMessage.error('导出失败')
  }
}

// 保存单个区块
async function saveSection(sectionName) {
  const sectionEl = document.querySelector(`.${sectionName}-section`)
  if (!sectionEl) return
  
  try {
    const canvas = await html2canvas(sectionEl, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })
    
    const link = document.createElement('a')
    link.download = `section-${sectionName}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.9)
    link.click()
    
    ElMessage.success(`${sectionName} 区块保存成功`)
  } catch (err) {
    console.error('Save section failed:', err)
    ElMessage.error('保存失败')
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f0f2f5;
}

.app-container {
  display: flex;
  height: 100vh;
}

/* 侧边栏 */
.sidebar {
  width: 320px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #f0f2f5;
  text-align: center;
}

.sidebar-header h1 {
  font-size: 20px;
  color: #303133;
  margin-bottom: 4px;
}

.sidebar-header p {
  font-size: 13px;
  color: #909399;
}

.sidebar-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.form-section {
  margin-bottom: 24px;
}

.form-section label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #606266;
}

.full-width {
  width: 100%;
  margin-top: 12px;
}

.upload-area {
  width: 100%;
}

.upload-area .el-upload-dragger {
  width: 100%;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  font-size: 40px;
  color: #c0c4cc;
}

.upload-text {
  color: #909399;
  margin-top: 8px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-header {
  margin-bottom: 16px;
}

/* 详情页预览 */
.detail-page {
  width: 1000px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

/* 通用 Section 样式 */
.section {
  position: relative;
  width: 100%;
}

.section-bg {
  width: 100%;
  height: auto;
  display: block;
}

.save-section-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.3s;
}

.section:hover .save-section-btn {
  opacity: 1;
}

.save-section-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

/* Hero Section */
.hero-section {
  height: 600px;
  background-size: cover;
  background-position: center;
}

.hero-section .section-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.product-image-slot {
  width: 400px;
  height: 400px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
}

.product-image-slot:hover {
  border-color: #409eff;
  background: rgba(255, 255, 255, 0.2);
}

.product-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.placeholder .el-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.hero-title {
  margin-top: 24px;
  font-size: 42px;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Intro Section */
.intro-section {
  display: flex;
  min-height: 400px;
  background: #fafafa;
}

.intro-left {
  width: 50%;
}

.intro-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.intro-right {
  width: 50%;
  padding: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.intro-right h3 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 20px;
}

.intro-text {
  font-size: 18px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-line;
}

/* Pairing Section */
.pairing-section {
  height: 500px;
}

.pairing-section .section-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pairing-overlay {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  padding: 40px;
}

.pairing-overlay h3 {
  font-size: 32px;
  margin-bottom: 16px;
}

.pairing-overlay p {
  font-size: 20px;
  max-width: 600px;
  line-height: 1.6;
}

/* Footer Section */
.footer-section {
  padding: 40px;
  background: #1a1a1a;
  text-align: center;
}

.footer-section p {
  font-size: 18px;
  color: #fff;
  letter-spacing: 4px;
}
</style>
