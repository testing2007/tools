<template>
  <el-container class="app-container">
    <el-aside width="260px" class="aside">
      <div class="aside-header">
        <h3>详情页项目</h3>
        <div class="header-actions">
          <el-button type="info" circle @click="loadProjects">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button type="primary" circle @click="createNewProject">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
      </div>
      <el-scrollbar>
        <div 
          v-for="proj in projects" 
          :key="proj.id" 
          :class="['project-item', { active: currentProjectId === proj.id }]"
          @click="selectProject(proj)"
        >
          <div class="project-info">
            <span class="project-name">{{ proj.name }}</span>
            <span class="project-date">{{ proj.updatedAt }}</span>
          </div>
          <el-button type="danger" link @click.stop="deleteProject(proj.id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </el-scrollbar>
    </el-aside>

    <el-main class="main-area">
      <div class="toolbar">
        <el-input v-model="currentProject.name" placeholder="项目名称" style="width: 200px" />
        <div class="actions">
          <el-button type="success" @click="saveProject">
            <el-icon><Check /></el-icon> 暂存代码
          </el-button>
          <el-button type="danger" @click="saveToPhysicalFile" :disabled="!currentProject.folderName">
            <el-icon><Monitor /></el-icon> 保存同步到物理文件
          </el-button>
          <el-button type="warning" @click="exportImage">
            <el-icon><Download /></el-icon> 导出长图
          </el-button>
          <el-button type="primary" @click="exportAllSections">
            <el-icon><Files /></el-icon> 批量切图
          </el-button>
          <el-button type="info" @click="exportCode">
            <el-icon><Document /></el-icon> 导出源码
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="editor-tabs">
        <el-tab-pane label="HTML" name="html">
          <el-input
            v-model="currentProject.html"
            type="textarea"
            :rows="20"
            placeholder="输入 HTML 代码..."
            class="code-editor"
          />
        </el-tab-pane>
        <el-tab-pane label="CSS" name="css">
          <el-input
            v-model="currentProject.css"
            type="textarea"
            :rows="20"
            placeholder="输入 CSS 代码..."
            class="code-editor"
          />
        </el-tab-pane>
        <el-tab-pane label="预览" name="preview">
          <div class="preview-container" @click="handlePreviewClick">
            <div 
              class="preview-content" 
              id="preview-content" 
              :style="{ width: '1000px' }"
              v-html="renderedHTML"
            ></div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-main>

    <!-- 样式编辑器抽屉 -->
    <el-drawer
      v-model="isEditorOpen"
      :title="editMode === 'element' ? '元素样式编辑' : '板块 (Section) 编辑'"
      direction="rtl"
      size="320px"
    >
      <!-- 元素编辑器 -->
      <el-form v-if="editMode === 'element'" :model="elementSettings" label-width="80px" size="small">
        <el-form-item label="文本内容">
          <el-input v-model="elementSettings.text" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="文字颜色">
          <el-color-picker v-model="elementSettings.color" />
        </el-form-item>
        <el-form-item label="字体大小">
          <el-input v-model="elementSettings.fontSize" placeholder="16px" />
        </el-form-item>
        <el-form-item label="加粗">
          <el-switch v-model="elementSettings.isBold" />
        </el-form-item>
        <el-form-item label="装饰">
          <el-checkbox-group v-model="elementSettings.decorations">
            <el-checkbox label="underline">下划线</el-checkbox>
            <el-checkbox label="line-through">删除线</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="文字阴影">
          <el-input v-model="elementSettings.textShadow" placeholder="2px 2px 4px rgba(0,0,0,0.3)" />
        </el-form-item>
        <el-form-item label="背景颜色">
          <el-color-picker v-model="elementSettings.backgroundColor" show-alpha />
        </el-form-item>
        
        <div style="margin-top: 20px; display: flex; gap: 10px">
          <el-button type="primary" @click="applyChangesToProject" style="flex: 1">同步到源码</el-button>
          <el-button @click="isEditorOpen = false">取消</el-button>
        </div>
      </el-form>

      <!-- Section 编辑器 -->
      <el-form v-else :model="sectionSettings" label-width="80px" size="small">
        <el-form-item label="背景图片">
          <div style="display: flex; gap: 10px; flex-direction: column;">
            <el-input v-model="sectionSettings.bgImage" placeholder="图片 URL" @change="onBgImageChange" />
            <el-upload
              class="bg-uploader"
              :action="`http://localhost:3002/api/upload?folderName=${currentProject.folderName}`"
              name="image"
              :show-file-list="false"
              :on-success="handleUploadSuccess"
              :before-upload="beforeUpload"
              :disabled="!currentProject.folderName"
            >
              <el-button type="primary" size="small" :disabled="!currentProject.folderName">
                上传本地图片
              </el-button>
              <template #tip>
                <div class="el-upload__tip" style="font-size: 10px; color: #f56c6c" v-if="!currentProject.folderName">
                  请先保存为物理文件夹后再上传图片
                </div>
              </template>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="背景大小(%)">
          <el-slider v-model="sectionSettings.bgSize" :min="10" :max="300" />
        </el-form-item>
        <el-form-item label="垂直位置(%)">
          <el-slider v-model="sectionSettings.bgPosY" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="板块高度(px)">
          <el-input-number v-model="sectionSettings.height" :min="0" :max="5000" />
          <el-button type="text" @click="syncHeightToImage">根据图片吸附</el-button>
        </el-form-item>
        <el-form-item label="边缘高亮">
          <el-switch v-model="sectionSettings.highlight" />
        </el-form-item>
        
        <div style="margin-top: 20px; display: flex; gap: 10px">
          <el-button type="primary" @click="applyChangesToProject" style="flex: 1">同步到源码</el-button>
          <el-button @click="isEditorOpen = false">取消</el-button>
        </div>
      </el-form>
      
      <div style="margin-top: 30px; font-size: 12px; color: #999;">
        <p v-if="editMode === 'element'">提示：点击文字编辑内容和样式。</p>
        <p v-else>提示：您可以调整背景图的缩放高度，点击“同步到源码”保存。设置背景图后建议点击“根据图片吸附”。</p>
      </div>
    </el-drawer>
  </el-container>

  <!-- Hidden style tag for preview CSS -->
  <component :is="'style'" v-if="activeTab === 'preview'">
    {{ currentProject.css }}
  </component>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import html2canvas from 'html2canvas'
import { Plus, Delete, Check, Download, Document, Refresh, Camera, Files, Edit, Monitor } from '@element-plus/icons-vue'

const activeTab = ref('html')
const projects = ref([])
const currentProjectId = ref(null)

const defaultHtml = `
<div class="detail-page">
  <section class="banner">
    <h1>新品发布</h1>
    <p>点击 Antigravity 为您生成更多创意内容</p>
  </section>
  <section class="specs">
    <h2>产品规格</h2>
    <ul>
      <li>材质: 316L 不锈钢</li>
      <li>尺寸: 1000px 宽度适配</li>
    </ul>
  </section>
</div>
`

const defaultCss = `
.detail-page {
  font-family: 'PingFang SC', sans-serif;
  color: #333;
  background: #fff;
}
.banner {
  height: 400px;
  background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
}
.specs {
  padding: 40px;
}
`

const currentProject = ref({
  id: Date.now(),
  name: '新项目',
  html: defaultHtml,
  css: defaultCss,
  updatedAt: new Date().toLocaleString()
})

const isEditorOpen = ref(false)
const editMode = ref('element') // 'element' or 'section'
const targetElement = ref(null)

const elementSettings = ref({
  text: '',
  color: '',
  fontSize: '',
  isBold: false,
  decorations: [],
  textShadow: '',
  backgroundColor: ''
})

const sectionSettings = ref({
  bgImage: '',
  bgSize: 100,
  bgPosY: 50,
  height: 400,
  highlight: false
})

const handlePreviewClick = (e) => {
  // Check if click on section-capture-btn
  if (e.target.closest('.section-capture-btn')) return

  // Find if click on a text element first
  const textEl = e.target.closest('h1, h2, h3, p, span, .badge')
  if (textEl && textEl.id !== 'preview-content') {
    editMode.value = 'element'
    targetElement.value = textEl
    loadElementSettings(textEl)
    isEditorOpen.value = true
    return
  }

  // Then check if click on a section
  const sectionEl = e.target.closest('.section')
  if (sectionEl) {
    editMode.value = 'section'
    targetElement.value = sectionEl
    loadSectionSettings(sectionEl)
    isEditorOpen.value = true
    return
  }
}

const loadElementSettings = (el) => {
  const computed = window.getComputedStyle(el)
  elementSettings.value = {
    text: el.innerHTML.trim(),
    color: rgbToHex(computed.color),
    fontSize: computed.fontSize,
    isBold: computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 700,
    decorations: computed.textDecoration.split(' ').filter(d => ['underline', 'line-through'].includes(d)),
    textShadow: computed.textShadow === 'none' ? '' : computed.textShadow,
    backgroundColor: rgbToHex(computed.backgroundColor)
  }
}

const loadSectionSettings = (el) => {
  const computed = window.getComputedStyle(el)
  const bgImg = computed.backgroundImage
  const bgSize = computed.backgroundSize
  const bgPos = computed.backgroundPosition.split(' ')

  sectionSettings.value = {
    bgImage: bgImg === 'none' ? '' : bgImg.replace(/url\(['"]?(.+?)['"]?\)/, '$1'),
    bgSize: bgSize === 'cover' ? 100 : (parseInt(bgSize) || 100),
    bgPosY: parseInt(bgPos[1]) || 50,
    height: el.offsetHeight,
    highlight: true
  }
}

let imageNaturalHeight = 0
let imageNaturalWidth = 0

const onBgImageChange = (url) => {
  if (!url) {
    imageNaturalHeight = 0
    return
  }
  const img = new Image()
  img.onload = () => {
    imageNaturalHeight = img.naturalHeight
    imageNaturalWidth = img.naturalWidth
    ElMessage.info(`图片已加载: ${img.naturalWidth}x${img.naturalHeight}px`)
  }
  img.src = url
}

const beforeUpload = (file) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
  if (!isJpgOrPng) {
    ElMessage.error('仅预览上传 JPG/PNG/WebP 格式图片!');
    return false;
  }
  return true;
}

const handleUploadSuccess = (response) => {
  sectionSettings.value.bgImage = response.url
  onBgImageChange(response.url)
  ElMessage.success('图片上传成功并已应用')
}

const syncHeightToImage = () => {
  if (imageNaturalHeight && imageNaturalWidth) {
    // scale height based on 1000px width and bgSize
    const scaledHeight = Math.round((imageNaturalHeight * (1000 / imageNaturalWidth)) * (sectionSettings.value.bgSize / 100))
    sectionSettings.value.height = scaledHeight
    ElMessage.success('已根据图片比例智能吸附高度')
  } else {
    ElMessage.warning('尚未加载图片或无法获取尺寸')
  }
}

const rgbToHex = (rgb) => {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#ffffff00'
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/)
  if (!match) return rgb
  const r = parseInt(match[1]).toString(16).padStart(2, '0')
  const g = parseInt(match[2]).toString(16).padStart(2, '0')
  const b = parseInt(match[3]).toString(16).padStart(2, '0')
  // Handle alpha
  if (match[4]) {
    const a = Math.round(parseFloat(match[4]) * 255).toString(16).padStart(2, '0')
    return `#${r}${g}${b}${a}`
  }
  return `#${r}${g}${b}`
}

watch(elementSettings, (val) => {
  if (editMode.value !== 'element' || !targetElement.value) return
  const el = targetElement.value
  
  // Apply live changes
  el.innerHTML = val.text 
  el.style.color = val.color
  el.style.fontSize = val.fontSize
  el.style.fontWeight = val.isBold ? 'bold' : 'normal'
  el.style.textDecoration = val.decorations.join(' ')
  el.style.textShadow = val.textShadow
  el.style.backgroundColor = val.backgroundColor
}, { deep: true })

watch(sectionSettings, (val) => {
  if (editMode.value !== 'section' || !targetElement.value) return
  const el = targetElement.value
  
  el.style.backgroundImage = val.bgImage ? `url(${val.bgImage})` : 'none'
  el.style.backgroundSize = `${val.bgSize}% auto`
  el.style.backgroundPosition = `center ${val.bgPosY}%`
  el.style.height = `${val.height}px`
  el.style.backgroundRepeat = 'no-repeat'
  
  if (val.highlight) {
    el.classList.add('section-editing')
  } else {
    el.classList.remove('section-editing')
  }
}, { deep: true })

const applyChangesToProject = () => {
  const previewDiv = document.getElementById('preview-content').cloneNode(true)
  
  // Cleanup preview-only elements and classes
  const allSections = previewDiv.querySelectorAll('.section')
  allSections.forEach(sec => {
    sec.classList.remove('section-editing')
  })

  const captureBtns = previewDiv.querySelectorAll('.section-capture-btn')
  captureBtns.forEach(btn => btn.remove())
  
  // Update the project HTML
  currentProject.value.html = previewDiv.innerHTML
  isEditorOpen.value = false
  ElMessage.success('已同步到源码')
}

const renderedHTML = computed(() => {
  // Inject a capture button into each section for the preview
  const rawHtml = currentProject.value.html
  if (activeTab.value !== 'preview') return rawHtml

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = rawHtml
  const sections = tempDiv.querySelectorAll('.section')
  sections.forEach((section, index) => {
    section.style.position = 'relative'
    const btn = document.createElement('div')
    btn.className = 'section-capture-btn'
    btn.setAttribute('data-html2canvas-ignore', 'true') // Exclude from screenshots
    btn.innerHTML = `截取此屏 (Section ${index + 1})`
    btn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(64, 158, 255, 0.9);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s;
    `
    section.appendChild(btn)
  })
  return tempDiv.innerHTML
})

// Persistence
const loadProjects = () => {
  // Clear existing to avoid duplicates if re-scanning
  projects.value = []
  // 1. Load from localStorage first (for user edits and new projects)
  const saved = localStorage.getItem('detail_generator_projects')
  if (saved) {
    projects.value = JSON.parse(saved)
  }

  // 2. Load from local filesystem (using Vite glob)
  // We use eager: true to get the content directly if needed, or just the paths
  const htmlFiles = import.meta.glob('../product_details/**/index.html', { query: '?raw', import: 'default', eager: true })
  const cssFiles = import.meta.glob('../product_details/**/style.css', { query: '?raw', import: 'default', eager: true })

  Object.entries(htmlFiles).forEach(([path, html]) => {
    // Extract folder name: ../product_details/1_legend/index.html -> 1_legend
    const match = path.match(/product_details\/(.+)\/index\.html/)
    if (match) {
      const folderName = match[1]
      const cssPath = path.replace('index.html', 'style.css')
      const css = cssFiles[cssPath] || ''
      
      // Check if project already exists (don't overwrite localStorage edits if any)
      const existing = projects.value.find(p => p.folderName === folderName)
      if (!existing) {
        projects.value.push({
          id: 'local_' + folderName,
          folderName: folderName,
          name: folderName,
          html: html,
          css: css,
          updatedAt: '本地文件',
          isLocal: true
        })
      }
    }
  })
}

const saveToLocal = () => {
  localStorage.setItem('detail_generator_projects', JSON.stringify(projects.value))
}

const createNewProject = () => {
  currentProject.value = {
    id: Date.now(),
    name: '未命名项目 ' + (projects.value.length + 1),
    html: defaultHtml,
    css: defaultCss,
    updatedAt: new Date().toLocaleString()
  }
  currentProjectId.value = currentProject.value.id
  activeTab.value = 'html'
}

const saveProject = () => {
  currentProject.value.updatedAt = new Date().toLocaleString()
  const index = projects.value.findIndex(p => p.id === currentProject.value.id)
  if (index !== -1) {
    projects.value[index] = { ...currentProject.value }
  } else {
    projects.value.push({ ...currentProject.value })
  }
  saveToLocal()
  ElMessage.success('代码已暂存到浏览器')
}

const saveToPhysicalFile = async () => {
  if (!currentProject.value.folderName) {
    // For new projects, ask for a folder name
    const { value: name } = await ElMessageBox.prompt('请输入物理文件夹名称', '首次保存', {
      inputPattern: /^[a-zA-Z0-9_-]+$/,
      inputErrorMessage: '文件夹名称格式不正确 (字母/数字/下划线)',
      inputValue: currentProject.value.name
    })
    currentProject.value.folderName = name
  }

  try {
    const response = await fetch('http://localhost:3002/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderName: currentProject.value.folderName,
        html: currentProject.value.html,
        css: currentProject.value.css
      })
    })
    
    if (response.ok) {
      ElMessage.success('物理文件已同步更新！')
      saveProject() // Also update localStorage
    } else {
      throw new Error('Save failed')
    }
  } catch (err) {
    console.error(err)
    ElMessageBox.alert('请确保后端服务 (node server.js) 正在运行。', '保存失败', { type: 'error' })
  }
}

const selectProject = (proj) => {
  currentProject.value = { ...proj }
  currentProjectId.value = proj.id
}

const deleteProject = (id) => {
  ElMessageBox.confirm('确定要删除这个项目吗？', '提示', { type: 'warning' })
    .then(() => {
      projects.value = projects.value.filter(p => p.id !== id)
      saveToLocal()
      if (currentProject.value.id === id) {
        createNewProject()
      }
    })
}

const exportCode = () => {
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${currentProject.value.name}</title>
  <style>
    ${currentProject.value.css}
  </style>
</head>
<body>
  ${currentProject.value.html}
</body>
</html>
`
  const blob = new Blob([fullHtml], { type: 'text/html' })
  const link = document.createElement('a')
  link.download = `${currentProject.value.name}.html`
  link.href = URL.createObjectURL(blob)
  link.click()
  ElMessage.success('源码已下载')
}

const exportImage = async () => {
  activeTab.value = 'preview'
  await nextTick()
  
  const element = document.getElementById('preview-content')
  if (!element) return

  ElMessage.info('正在生成长图，请稍候...')
  
  try {
    // Force a scroll to the top to ensure full capture
    const canvas = await html2canvas(element, {
      width: 1000,
      height: element.scrollHeight,
      windowHeight: element.scrollHeight,
      useCORS: true,
      scale: 1,
      logging: false,
    })
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const link = document.createElement('a')
    link.download = `${currentProject.value.name}_长图.jpg`
    link.href = dataUrl
    link.click()
    ElMessage.success('长图已导出')
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error('长图生成失败')
  }
}

const captureElement = async (element, filename) => {
  const canvas = await html2canvas(element, {
    width: 1000,
    useCORS: true,
    scale: 2, // Higher scale for better quality
    logging: false,
  })
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

const exportAllSections = async () => {
  activeTab.value = 'preview'
  await nextTick()
  
  const sections = document.querySelectorAll('#preview-content .section')
  if (sections.length === 0) {
    ElMessage.warning('未找到任何 section 标签')
    return
  }

  ElMessage.info(`开始全量切图，共 ${sections.length} 个部分...`)
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    // Try to find a title for the filename
    const titleEl = section.querySelector('h1, h2, h3')
    const sectionName = titleEl ? titleEl.innerText.trim().substring(0, 10) : `部分${i + 1}`
    
    // Temporarily hide our custom capture buttons if they exist
    const btns = section.querySelector('.section-capture-btn')
    if (btns) btns.style.opacity = '0'
    
    await captureElement(section, `${currentProject.value.name}_${i + 1}_${sectionName}.jpg`)
    
    if (btns) btns.style.opacity = '1'
    // Small delay to ensure browser handles downloads
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  ElMessage.success('批量切图完成')
}

// Global click handler for individual section capture
onMounted(() => {
  window.addEventListener('click', async (e) => {
    if (e.target.closest('.section-capture-btn')) {
      const btn = e.target.closest('.section-capture-btn')
      const section = btn.parentElement
      
      const titleEl = section.querySelector('h1, h2, h3')
      const sectionName = titleEl ? titleEl.innerText.trim().substring(0, 15) : '单页'
      
      btn.style.opacity = '0'
      try {
        await captureElement(section, `${currentProject.value.name}_${sectionName}.jpg`)
        ElMessage.success(`[${sectionName}] 导出成功`)
      } catch (err) {
        ElMessage.error('导出失败')
      }
      btn.style.opacity = '1'
    }
  })
})

import { nextTick } from 'vue'

onMounted(() => {
  loadProjects()
  if (projects.value.length > 0) {
    selectProject(projects.value[0])
  } else {
    createNewProject()
  }
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  background-color: #f5f7fa;
}

.aside {
  background-color: #fff;
  border-right: 1px solid #dcdfe6;
  display: flex;
  flex-direction: column;
}

.aside-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ebeef5;
}

.aside-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.project-item {
  padding: 15px 20px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f2f6fc;
  transition: all 0.3s;
}

.project-item:hover {
  background-color: #f5f7fa;
}

.project-item.active {
  background-color: #ecf5ff;
  border-left: 4px solid #409eff;
}

.project-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-name {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.project-date {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.main-area {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.editor-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor-tabs :deep(.el-tabs__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.code-editor :deep(.el-textarea__inner) {
  font-family: 'Fira Code', 'Monaco', monospace;
  font-size: 14px;
  height: 100%;
  background-color: #282c34;
  color: #abb2bf;
}

.preview-container {
  background-color: #e4e7ed;
  padding: 40px;
  display: flex;
  justify-content: center;
  overflow-y: auto;
  height: calc(100vh - 200px);
}

.preview-content {
  background-color: #fff;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  min-height: 1000px;
}

:deep(.section-editing) {
  outline: 4px solid #409eff !important;
  outline-offset: -4px !important;
  position: relative;
  z-index: 10 !important;
}

/* Hover to show capture buttons */
:deep(.section:hover .section-capture-btn) {
  opacity: 1 !important;
}
</style>
