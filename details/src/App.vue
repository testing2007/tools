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
        <el-input v-model="currentProject.productTitle" placeholder="产品主标题" style="width: 240px; margin-left: 10px;" />
        <div class="actions">
          <el-button type="success" @click="saveProject">
            <el-icon><Check /></el-icon> 暂存代码
          </el-button>
          <el-button type="danger" @click="saveToPhysicalFile" :disabled="!currentProject.folderName">
            <el-icon><Monitor /></el-icon> 保存物理文件
          </el-button>
          <el-button type="warning" @click="exportImage">
            <el-icon><Download /></el-icon> 导出长图
          </el-button>
          <el-button type="primary" @click="exportAllSections">
            <el-icon><Files /></el-icon> 批量切图
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="editor-tabs">
        <el-tab-pane label="详情页 (1000px)" name="detail">
          <el-tabs v-model="subTabDetail" type="border-card">
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
              <div class="preview-container" @click="handlePreviewClick" @mousedown="handlePreviewMouseDown">
                <div 
                  class="preview-content" 
                  id="preview-content" 
                  :style="{ width: '1000px' }"
                  v-html="renderedHTML"
                ></div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>

        <el-tab-pane label="营销素材 (Carousel/Share)" name="marketing">
          <el-tabs v-model="subTabMarketing" type="border-card">
            <el-tab-pane label="轮播图 (800x800)" name="carousel">
              <div class="marketing-split">
                <div class="marketing-editor">
                  <el-form label-position="top">
                    <el-form-item label="HTML">
                      <el-input v-model="currentProject.bannerHtml" type="textarea" :rows="10" />
                    </el-form-item>
                    <el-form-item label="CSS">
                      <el-input v-model="currentProject.bannerCss" type="textarea" :rows="10" />
                    </el-form-item>
                  </el-form>
                </div>
                <div class="marketing-preview">
                  <div class="preview-box" id="banner-preview" style="width: 800px; height: 800px;" v-html="currentProject.bannerHtml"></div>
                  <el-button type="primary" @click="exportBannerImage" style="margin-top: 20px">
                    <el-icon><Download /></el-icon> 下载轮播图 (800x800)
                  </el-button>
                </div>
              </div>
              <component :is="'style'">{{ currentProject.bannerCss }}</component>
            </el-tab-pane>

            <el-tab-pane label="描述/分享语" name="copywriting">
              <el-form label-position="top" style="padding: 20px;">
                <div style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
                  <el-button type="warning" @click="syncFromDetail">
                    <el-icon><Refresh /></el-icon> 从详情页智能提取
                  </el-button>
                </div>
                
                <el-form-item label="产品主标题">
                  <div style="display: flex; gap: 10px;">
                    <el-input v-model="currentProject.productTitle" />
                    <el-button @click="copyToClipboard(currentProject.productTitle)">复制</el-button>
                  </div>
                </el-form-item>

                <el-form-item label="产品文字描述">
                  <el-input v-model="currentProject.description" type="textarea" :rows="6" />
                  <div style="margin-top: 5px;">
                    <el-button type="primary" size="small" @click="copyToClipboard(currentProject.description)">复制描述</el-button>
                  </div>
                </el-form-item>

                <el-form-item label="分享语">
                  <el-input v-model="currentProject.shareText" type="textarea" :rows="4" />
                  <div style="margin-top: 5px;">
                    <el-button type="primary" size="small" @click="copyToClipboard(currentProject.shareText)">复制分享语</el-button>
                  </div>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="分享图 (5:4)" name="share_img">
              <div class="marketing-split">
                <div class="marketing-editor">
                  <el-form label-position="top">
                    <el-form-item label="HTML">
                      <el-input v-model="currentProject.shareHtml" type="textarea" :rows="10" />
                    </el-form-item>
                    <el-form-item label="CSS">
                      <el-input v-model="currentProject.shareCss" type="textarea" :rows="10" />
                    </el-form-item>
                  </el-form>
                </div>
                <div class="marketing-preview">
                  <div class="preview-box" id="share-preview" style="width: 1000px; height: 800px; transform: scale(0.4); transform-origin: top center;" v-html="currentProject.shareHtml"></div>
                  <el-button type="primary" @click="exportShareImage" style="margin-top: -450px">
                    <el-icon><Download /></el-icon> 下载分享图 (1000x800)
                  </el-button>
                </div>
              </div>
              <component :is="'style'">{{ currentProject.shareCss }}</component>
            </el-tab-pane>
          </el-tabs>
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

        <el-divider content-position="left">变换 (Transform)</el-divider>
        <el-form-item label="水平位置(X)">
          <el-slider v-model="elementSettings.left" :min="-500" :max="1000" />
        </el-form-item>
        <el-form-item label="垂直位置(Y)">
          <el-slider v-model="elementSettings.top" :min="-500" :max="5000" />
        </el-form-item>
        <el-form-item label="旋转角度">
          <el-slider v-model="elementSettings.rotate" :min="-180" :max="180" />
        </el-form-item>
        <el-form-item label="缩放倍率">
          <el-slider v-model="elementSettings.scale" :min="0.1" :max="3" :step="0.1" />
        </el-form-item>
        <el-form-item label="绝对定位">
          <el-switch v-model="elementSettings.isAbsolute" />
          <div style="font-size: 10px; color: #999; line-height: 1.2; margin-top: 4px;">开启绝对定位后文字可自由移动</div>
        </el-form-item>

        <el-divider content-position="left">快速对齐</el-divider>
        <el-form-item label="对齐">
          <el-button-group>
            <el-button @click="quickAlign('left')" :disabled="!elementSettings.isAbsolute">⬅ 左</el-button>
            <el-button @click="quickAlign('center')" :disabled="!elementSettings.isAbsolute">⬜ 中</el-button>
            <el-button @click="quickAlign('right')" :disabled="!elementSettings.isAbsolute">➡ 右</el-button>
          </el-button-group>
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
        <el-form-item label="背景颜色">
          <el-color-picker v-model="sectionSettings.backgroundColor" show-alpha />
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import html2canvas from 'html2canvas'
import { Plus, Delete, Check, Download, Document, Refresh, Camera, Files, Edit, Monitor } from '@element-plus/icons-vue'

// Composables
import { useHistory } from './composables/useHistory'
import { useAlignment, applyAlignment } from './composables/useAlignment'

// Initialize composables
const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistory()
const { SECTION_WIDTH } = useAlignment()

const activeTab = ref('detail')
const subTabDetail = ref('preview')
const subTabMarketing = ref('carousel')

const projects = ref([])
const currentProjectId = ref(null)

const defaultHtml = `
<div class="detail-page">
  <section class="section banner" style="background-image: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000'); background-size: cover; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white;">
    <h1 style="font-size: 48px; margin-bottom: 10px;">智能极简手表</h1>
    <p style="font-size: 20px;">重新定义您的时间，极简美学，不凡品味</p>
  </section>
  <section class="section white" style="padding: 60px 40px; background: #fff;">
    <h2 style="font-size: 32px; text-align: center; border-bottom: 2px solid #333; display: inline-block; padding-bottom: 10px; margin-bottom: 40px; width: 100%;">匠心工艺</h2>
    <div style="display: flex; gap: 40px; align-items: center;">
       <div style="flex: 1;"><img src="https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&q=80&w=500" style="width: 100%; border-radius: 8px;"></div>
       <div style="flex: 1;">
         <h3 style="font-size: 24px;">316L 精钢表壳</h3>
         <p style="color: #666; line-height: 1.8;">采用高规格精钢，经过 12 道工序手工抛光，温润如玉，经久耐用。</p>
       </div>
    </div>
  </section>
  <section class="section gray" style="padding: 60px 40px; background: #f9f9f9;">
    <h2 style="font-size: 32px; text-align: center; margin-bottom: 40px;">极致规格</h2>
    <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <li style="background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"><strong>运动机芯:</strong> 瑞士原装石英机芯</li>
      <li style="background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"><strong>防水性能:</strong> 50米生活防水</li>
      <li style="background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"><strong>镜面材质:</strong> 蓝宝石玻璃</li>
      <li style="background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"><strong>表带材质:</strong> 意大利头层牛皮</li>
    </ul>
  </section>
</div>
`

const defaultCss = `
.detail-page {
  font-family: 'PingFang SC', 'STHeiti', 'Microsoft YaHei', sans-serif;
  color: #333;
  line-height: 1.5;
}
.section {
  width: 1000px;
  overflow: hidden;
}
`

const defaultBannerHtml = `
<div class="banner-carousel" style="width: 800px; height: 800px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; overflow: hidden; border: 1px solid #eee;">
  <!-- Decor elements -->
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 50% 120%, rgba(0,0,0,0.05) 0%, transparent 70%);"></div>
  <div style="font-size: 200px; font-weight: 900; color: #f0f0f0; position: absolute; z-index: 1; top: 40px; transform: rotate(-5deg); pointer-events: none; letter-spacing: -5px;">PREMIUM</div>
  
  <div style="z-index: 2; text-align: center; width: 100%;">
    <div style="text-transform: uppercase; letter-spacing: 4px; font-size: 14px; color: #999; margin-bottom: 20px;">NEW COLLECTION 2026</div>
    <h2 style="font-size: 64px; font-weight: 800; color: #111; margin: 0; line-height: 1.1;">智能极简手表</h2>
    <div style="width: 40px; height: 2px; background: #333; margin: 30px auto;"></div>
  </div>

  <div style="z-index: 2; position: relative; width: 450px; height: 450px; margin-top: 20px;">
    <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.1));">
  </div>
  
  <div style="z-index: 2; margin-top: 20px; display: flex; gap: 30px;">
    <div style="text-align: center;">
      <div style="font-size: 12px; color: #aaa;">WATER RESISTANT</div>
      <div style="font-size: 16px; font-weight: bold; color: #333;">50M</div>
    </div>
    <div style="text-align: center;">
      <div style="font-size: 12px; color: #aaa;">SWISS MOVEMENT</div>
      <div style="font-size: 16px; font-weight: bold; color: #333;">QUARTZ</div>
    </div>
  </div>
</div>
`

const defaultShareHtml = `
<div class="share-pic" style="width: 1000px; height: 800px; background: #fff; display: flex; flex-direction: column; border: 1px solid #eee; font-family: 'PingFang SC', sans-serif; overflow: hidden; position: relative;">
  <!-- Main image area -->
  <div style="flex: 1; position: relative; background: #fbfbfb;">
    <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000" style="width: 100%; height: 100%; object-fit: cover;">
    <div style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.7); color: #fff; padding: 10px 20px; border-radius: 4px; font-size: 24px;">精品好物推荐</div>
  </div>
  
  <!-- Content area -->
  <div style="height: 240px; padding: 40px; display: flex; justify-content: space-between; align-items: center; background: #fff;">
    <div style="flex: 1;">
      <h2 style="font-size: 40px; color: #333; margin: 0 0 10px;">智能极简手表</h2>
      <p style="font-size: 24px; color: #999; margin: 0; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">重新定义您的时间，极简美学，不凡品味</p>
    </div>
    <div style="width: 140px; height: 140px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-left: 30px;">
       <div style="text-align: center; color: #999;">
         <div style="font-size: 12px;">扫码查看</div>
         <div style="font-size: 40px;">QR</div>
       </div>
    </div>
  </div>
</div>
`

const currentProject = ref({
  id: Date.now(),
  name: '旗舰新品项目',
  productTitle: '智能极简手表',
  html: defaultHtml,
  css: defaultCss,
  bannerHtml: defaultBannerHtml,
  bannerCss: '',
  description: '这是一款融合了北欧极简美学与精准工艺的智能手表。它采用 316L 精钢表壳，蓝宝石镜面，搭载瑞士进口机芯。不仅是一款计时工具，更是你生活品味的象征。支持 50 米生活防水，佩戴舒适，适配多种场合。',
  shareHtml: defaultShareHtml,
  shareCss: '',
  shareText: '【新品首发】被这块表惊艳到了！极简主义巅峰之作，懂行的朋友快来看看 🔗 点击进入详情',
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
  backgroundColor: '',
  left: 0,
  top: 0,
  rotate: 0,
  scale: 1,
  isAbsolute: false
})

const sectionSettings = ref({
  bgImage: '',
  bgSize: 100,
  bgPosY: 50,
  height: 400,
  backgroundColor: '',
  highlight: false
})

const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, left: 0, top: 0 })

const handlePreviewMouseDown = (e) => {
  // Skip if clicking on capture button - it has its own special handler
  if (e.target.closest('.section-capture-btn')) return
  
  const textEl = e.target.closest('h1, h2, h3, p, span, .badge, div:not(.section):not(.detail-page):not(#preview-content):not(.section-capture-btn)')
  if (textEl && textEl.id !== 'preview-content' && !textEl.classList.contains('section') && !textEl.classList.contains('section-capture-btn')) {
    editMode.value = 'element'
    targetElement.value = textEl
    loadElementSettings(textEl)
    
    if (!elementSettings.value.isAbsolute) {
      // Calculate position BEFORE switching to absolute
      const section = textEl.closest('.section')
      const secRect = section.getBoundingClientRect()
      const elRect = textEl.getBoundingClientRect()
      
      // Store original dimensions
      const originalWidth = textEl.offsetWidth
      const originalHeight = textEl.offsetHeight
      
      // Create placeholder to maintain layout
      const placeholder = document.createElement('div')
      placeholder.className = 'element-placeholder'
      placeholder.style.cssText = `
        width: ${originalWidth}px;
        height: ${originalHeight}px;
        visibility: hidden;
        pointer-events: none;
      `
      placeholder.dataset.placeholderFor = textEl.dataset.elementId || Date.now()
      textEl.dataset.elementId = placeholder.dataset.placeholderFor
      textEl.parentNode.insertBefore(placeholder, textEl.nextSibling)
      
      // Now switch to absolute
      elementSettings.value.isAbsolute = true
      elementSettings.value.left = elRect.left - secRect.left
      elementSettings.value.top = elRect.top - secRect.top
    }

    isDragging.value = true
    dragStart.value = {
      x: e.clientX,
      y: e.clientY,
      left: elementSettings.value.left,
      top: elementSettings.value.top
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    e.preventDefault()
    isEditorOpen.value = true
  }
}

const handleGlobalMouseMove = (e) => {
  if (!isDragging.value || !targetElement.value) return
  
  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y
  
  let newLeft = dragStart.value.left + dx
  let newTop = dragStart.value.top + dy
  
  // Get section and element dimensions for boundary clamping
  const section = targetElement.value.closest('.section')
  if (section) {
    const sectionWidth = section.offsetWidth
    const sectionHeight = section.offsetHeight
    const elWidth = targetElement.value.offsetWidth
    const elHeight = targetElement.value.offsetHeight
    
    // Clamp to section bounds
    newLeft = Math.max(0, Math.min(newLeft, sectionWidth - elWidth))
    newTop = Math.max(0, Math.min(newTop, sectionHeight - elHeight))
  }
  
  elementSettings.value.left = newLeft
  elementSettings.value.top = newTop
}

const handleGlobalMouseUp = () => {
  if (isDragging.value) {
    // Sync current DOM state to project HTML
    const previewDiv = document.getElementById('preview-content')
    if (previewDiv) {
      // Clone and clean up preview-only elements
      const clone = previewDiv.cloneNode(true)
      clone.querySelectorAll('.section-editing').forEach(el => el.classList.remove('section-editing'))
      clone.querySelectorAll('.section-capture-btn').forEach(btn => btn.remove())
      clone.querySelectorAll('.element-placeholder').forEach(ph => ph.remove())
      
      // Update project HTML with new state
      currentProject.value.html = clone.innerHTML
      
      // Push the NEW state (after drag) to history
      // This allows undo to go back to this state
      pushSnapshot({ html: currentProject.value.html, css: currentProject.value.css })
    }
  }
  isDragging.value = false
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
}

const handlePreviewClick = (e) => {
  // Check if it was a drag or a simple click
  if (isDragging.value) return
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
    backgroundColor: rgbToHex(computed.backgroundColor),
    left: parseInt(computed.left) || 0,
    top: parseInt(computed.top) || 0,
    rotate: getRotationDegrees(computed.transform),
    scale: getScaleFactor(computed.transform),
    isAbsolute: computed.position === 'absolute'
  }
}

const getRotationDegrees = (matrix) => {
  if (!matrix || matrix === 'none') return 0
  const values = matrix.split('(')[1].split(')')[0].split(',')
  const a = values[0]
  const b = values[1]
  const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI))
  return angle
}

const getScaleFactor = (matrix) => {
  if (!matrix || matrix === 'none') return 1
  const values = matrix.split('(')[1].split(')')[0].split(',')
  const a = values[0]
  const b = values[1]
  const scale = Math.sqrt(a * a + b * b)
  return parseFloat(scale.toFixed(2))
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
    backgroundColor: rgbToHex(computed.backgroundColor),
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
  
  if (val.isAbsolute) {
    el.style.position = 'absolute'
    el.style.left = `${val.left}px`
    el.style.top = `${val.top}px`
    el.style.margin = '0'
    // Preserve width and prevent text wrapping
    if (!el.dataset.originalWidth) {
      el.dataset.originalWidth = el.offsetWidth
    }
    el.style.minWidth = `${el.dataset.originalWidth}px`
    el.style.whiteSpace = 'nowrap'
  } else {
    el.style.position = ''
    el.style.left = ''
    el.style.top = ''
    el.style.margin = ''
    el.style.width = ''
    el.style.minWidth = ''
    el.style.whiteSpace = ''
    delete el.dataset.originalWidth
  }

  el.style.transform = `rotate(${val.rotate}deg) scale(${val.scale})`
}, { deep: true })

watch(sectionSettings, (val) => {
  if (editMode.value !== 'section' || !targetElement.value) return
  const el = targetElement.value
  
  el.style.backgroundImage = val.bgImage ? `url(${val.bgImage})` : 'none'
  el.style.backgroundSize = `${val.bgSize}% auto`
  el.style.backgroundPosition = `center ${val.bgPosY}%`
  el.style.height = `${val.height}px`
  el.style.backgroundColor = val.backgroundColor || 'transparent'
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
  
  // Push to history before updating
  pushSnapshot({ html: currentProject.value.html, css: currentProject.value.css })

  // Update the project HTML
  currentProject.value.html = previewDiv.innerHTML
  isEditorOpen.value = false
  ElMessage.success('已同步到源码')
}

// Quick Alignment Function
const quickAlign = (alignment) => {
  const el = targetElement.value
  if (!el || !elementSettings.value.isAbsolute) return

  const elWidth = el.offsetWidth
  
  switch (alignment) {
    case 'left':
      elementSettings.value.left = 0
      break
    case 'center':
      elementSettings.value.left = Math.round((SECTION_WIDTH - elWidth) / 2)
      break
    case 'right':
      elementSettings.value.left = SECTION_WIDTH - elWidth
      break
  }
}

// Keyboard Shortcuts Handler
const handleKeyboardShortcuts = (e) => {
  // Ctrl+Z = Undo, Ctrl+Shift+Z or Ctrl+Y = Redo
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      // Redo (Ctrl+Shift+Z)
      const snapshot = redo()
      console.log('[Redo] snapshot:', snapshot, 'canRedo:', canRedo.value)
      if (snapshot) {
        currentProject.value.html = snapshot.html
        currentProject.value.css = snapshot.css
        ElMessage.info('重做成功')
      } else {
        ElMessage.warning('没有可重做的操作')
      }
    } else {
      // Undo (Ctrl+Z)
      const snapshot = undo()
      console.log('[Undo] snapshot:', snapshot, 'canUndo:', canUndo.value)
      if (snapshot) {
        currentProject.value.html = snapshot.html
        currentProject.value.css = snapshot.css
        ElMessage.info('撤销成功')
      } else {
        ElMessage.warning('没有可撤销的操作')
      }
    }
  }
  // Ctrl+Y = Redo (alternative)
  if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    const snapshot = redo()
    if (snapshot) {
      currentProject.value.html = snapshot.html
      currentProject.value.css = snapshot.css
      ElMessage.info('重做成功')
    } else {
      ElMessage.warning('没有可重做的操作')
    }
  }
}

const renderedHTML = computed(() => {
  let rawHtml = currentProject.value.html
  
  // Resolve relative image paths for preview
  if (currentProject.value.folderName) {
    const baseUrl = `http://localhost:3002/product_details/${currentProject.value.folderName}/`
    // Match src="images/..." or background-image: url('images/...')
    rawHtml = rawHtml.replace(/(src=["'])(images\/)/g, `$1${baseUrl}$2`)
    rawHtml = rawHtml.replace(/(url\(["']?)(images\/)/g, `$1${baseUrl}$2`)
  }

  if (activeTab.value !== 'detail' || subTabDetail.value !== 'preview') return rawHtml

  // Strip newlines and extra spaces between tags to avoid whitespace nodes causing gaps
  rawHtml = rawHtml.replace(/>\s+</g, '><')

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
const loadProjects = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/projects')
    if (response.ok) {
      const serverProjects = await response.json()
      projects.value = serverProjects.map(sp => ({
        ...sp,
        id: sp.id || 'local_' + sp.folderName,
        isLocal: true
      }))
      
      // If no project selected, or previously selected project no longer exists
      if (!currentProjectId.value && projects.value.length > 0) {
        selectProject(projects.value[0])
      } else if (currentProjectId.value) {
        const found = projects.value.find(p => p.id === currentProjectId.value)
        if (found) selectProject(found)
      }
    }
  } catch (err) {
    console.error('Failed to load server projects:', err)
  }
}

const createNewProject = () => {
  currentProject.value = {
    id: Date.now(),
    name: '未命名项目 ' + (projects.value.length + 1),
    productTitle: '',
    html: defaultHtml,
    css: defaultCss,
    bannerHtml: defaultBannerHtml,
    bannerCss: '',
    description: '此处输入产品描述...',
    shareHtml: defaultShareHtml,
    shareCss: '',
    shareText: '此处输入分享语...',
    updatedAt: new Date().toLocaleString()
  }
  currentProjectId.value = currentProject.value.id
  activeTab.value = 'marketing' // Default to marketing to see new features
  subTabMarketing.value = 'carousel'
}

const saveProjectInMemory = () => {
  currentProject.value.updatedAt = new Date().toLocaleString()
  const index = projects.value.findIndex(p => p.id === currentProject.value.id)
  if (index !== -1) {
    projects.value[index] = { ...currentProject.value }
  } else {
    projects.value.push({ ...currentProject.value })
  }
}

const saveProject = () => {
  saveProjectInMemory()
  ElMessage.success('代码已暂存（刷新浏览器将丢失）')
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
        css: currentProject.value.css,
        bannerHtml: currentProject.value.bannerHtml,
        bannerCss: currentProject.value.bannerCss,
        description: currentProject.value.description,
        shareHtml: currentProject.value.shareHtml,
        shareCss: currentProject.value.shareCss,
        shareText: currentProject.value.shareText
      })
    })
    
    if (response.ok) {
      ElMessage.success('物理文件同步保存成功！')
      await loadProjects() // Refresh side-bar
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
  
  // Push initial snapshot for undo/redo
  pushSnapshot({ html: proj.html, css: proj.css })
}

const deleteProject = (id) => {
  const proj = projects.value.find(p => p.id === id)
  const displayName = proj ? proj.name : '该项目'
  
  ElMessageBox.confirm(`确定要彻底删除“${displayName}”及其对应的物理文件夹吗？`, '警告', { 
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger'
  })
    .then(async () => {
      if (proj && proj.folderName) {
        try {
          const response = await fetch(`http://localhost:3002/api/delete?folderName=${proj.folderName}`, {
            method: 'DELETE'
          })
          if (response.ok) {
            ElMessage.success('项目已物理删除')
            loadProjects()
            if (currentProjectId.value === id) {
              createNewProject()
            }
          } else {
            ElMessage.error('物理删除失败')
          }
        } catch (err) {
          ElMessage.error('无法连接服务器进行删除')
        }
      } else {
        // Just remove from memory if it hasn't been saved to disk yet
        projects.value = projects.value.filter(p => p.id !== id)
        if (currentProjectId.value === id) createNewProject()
        ElMessage.success('已从列表中移除')
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
  activeTab.value = 'detail'
  subTabDetail.value = 'preview'
  await nextTick()
  await new Promise(r => setTimeout(r, 500)) // ensure images load
  
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

const exportBannerImage = async () => {
  activeTab.value = 'marketing'
  subTabMarketing.value = 'carousel'
  await nextTick()
  await new Promise(r => setTimeout(r, 300))
  
  const element = document.getElementById('banner-preview')
  if (!element) return
  ElMessage.info('正在生成轮播图...')
  try {
    const canvas = await html2canvas(element, {
      width: 800,
      height: 800,
      useCORS: true,
      scale: 2,
    })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const link = document.createElement('a')
    link.download = `${currentProject.value.name}_轮播图.jpg`
    link.href = dataUrl
    link.click()
    ElMessage.success('轮播图已导出')
  } catch (error) {
    ElMessage.error('轮播图生成失败')
  }
}

const syncFromDetail = () => {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = currentProject.value.html
  
  // 1. Extract Title (first h1 or h2)
  const titleEl = tempDiv.querySelector('h1, h2')
  if (titleEl) {
    currentProject.value.productTitle = titleEl.innerText.trim()
  }
  
  // 2. Extract Description (all P tags)
  const pTags = Array.from(tempDiv.querySelectorAll('p'))
    .map(p => p.innerText.trim())
    .filter(t => t.length > 5 && !t.includes('Section'))
    .slice(0, 5)
  if (pTags.length > 0) {
    currentProject.value.description = pTags.join('\n')
    currentProject.value.shareText = `【新品推荐】${currentProject.value.productTitle}：${pTags[0].substring(0, 30)}... 🔗 点击查看详情`
  }
  
  ElMessage.success('已从详情页智能提取文案')
}

const exportShareImage = async () => {
  activeTab.value = 'marketing'
  subTabMarketing.value = 'share_img'
  await nextTick()
  await new Promise(r => setTimeout(r, 300))

  const element = document.getElementById('share-preview')
  if (!element) return
  ElMessage.info('正在生成分享图...')
  try {
    const canvas = await html2canvas(element, {
      width: 1000,
      height: 800,
      useCORS: true,
      scale: 1.5,
    })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const link = document.createElement('a')
    link.download = `${currentProject.value.name}_分享图.jpg`
    link.href = dataUrl
    link.click()
    ElMessage.success('分享图已导出')
  } catch (error) {
    ElMessage.error('分享图生成失败')
  }
}

const copyToClipboard = (text) => {
  if (!text) {
    ElMessage.warning('内容为空')
    return
  }
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
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
  activeTab.value = 'detail'
  subTabDetail.value = 'preview'
  await nextTick()
  await new Promise(r => setTimeout(r, 500))
  
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
  // Section capture click handler
  window.addEventListener('click', async (e) => {
    if (e.target.closest('.section-capture-btn')) {
      // Prevent event bubbling and duplicate handling
      e.stopPropagation()
      e.stopImmediatePropagation()
      
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
  }, { capture: true }) // Use capture phase to intercept early

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Shift+Z)
  window.addEventListener('keydown', handleKeyboardShortcuts)

  // Load projects on mount
  loadProjects()
  if (projects.value.length > 0) {
    selectProject(projects.value[0])
  } else {
    createNewProject()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardShortcuts)
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

.marketing-split {
  display: flex;
  gap: 20px;
  height: 100%;
}

.marketing-editor {
  flex: 1;
  max-width: 500px;
}

.marketing-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f0f2f5;
  padding: 20px;
  border-radius: 8px;
  overflow: auto;
}

.preview-box {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
  flex-shrink: 0;
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

/* Aggressive Gap Killer */
:deep(.detail-page) {
  display: flex !important;
  flex-direction: column !important;
  margin: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  font-size: 0; /* Kill inline-block whitespace */
}

:deep(.section) {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  font-size: 16px; /* Reset font size for content */
}

:deep(.section h1), :deep(.section h2), :deep(.section h3), :deep(.section p), :deep(.section span) {
  cursor: move;
  user-select: none;
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
