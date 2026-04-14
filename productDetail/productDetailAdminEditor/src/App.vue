<template>
  <div class="editor-container">
    <el-container class="full-height">
      <!-- 头部 -->
      <el-header height="60px" class="header">
        <div class="logo">
          <el-icon><Monitor /></el-icon>
          小程序详情页配置台 - 增强版
        </div>
        <div class="actions">
          <el-button type="primary" @click="downloadJs">
            <el-icon><Download /></el-icon> 导出 JS 并保存
          </el-button>
        </div>
      </el-header>

      <el-container class="main-body">
        <!-- 左侧：表单配置区 -->
        <el-main class="left-panel">
          <div class="panel-header">
            <h3>页面配置结构</h3>
            <el-button type="success" plain size="small" @click="addGroup">
              <el-icon><Plus /></el-icon> 新增内容组 (Group)
            </el-button>
          </div>

          <el-collapse v-model="activeGroups">
            <el-collapse-item 
              v-for="(group, gIndex) in configData.groups" 
              :key="gIndex" 
              :name="gIndex"
            >
              <template #title>
                <div class="collapse-title">
                  <el-tag size="small" effect="dark">组 {{ gIndex + 1 }}</el-tag>
                  <span class="img-count">包含 {{ group.images.length }} 张图片</span>
                  <el-button 
                    type="danger" 
                    link 
                    size="small" 
                    class="delete-btn" 
                    @click.stop="deleteGroup(gIndex)"
                  >删除此组</el-button>
                </div>
              </template>

              <!-- 该组内的图片列表 -->
              <div class="group-content">
                <el-card 
                  v-for="(img, iIndex) in group.images" 
                  :key="iIndex" 
                  class="img-card" 
                  shadow="never"
                >
                  <template #header>
                    <div class="card-header">
                      <span>图片 {{ iIndex + 1 }} (ID: <b>{{ img.id }}</b>)</span>
                      <el-button type="danger" link @click="deleteImage(group, iIndex)">删除图片</el-button>
                    </div>
                  </template>

                  <!-- 图片基本信息 -->
                  <el-form label-width="110px">
                    <el-form-item label="标识符 (ID)">
                      <el-input v-model="img.id" placeholder="唯一标识" />
                    </el-form-item>
                    <el-form-item label="小程序路径">
                      <el-input v-model="img.src" placeholder="填写路径如 /assets/01.jpg" />
                    </el-form-item>
                    <el-form-item label="编辑器本地预览">
                      <input type="file" accept="image/*" @change="e => handleLocalImage(e, img)" style="font-size: 13px;" />
                    </el-form-item>
                  </el-form>

                  <el-divider>浮层与动画 ({{ img.overlays.length }})</el-divider>

                  <!-- 浮层列表 -->
                  <div 
                    v-for="(ov, oIndex) in img.overlays" 
                    :key="oIndex" 
                    class="overlay-box"
                  >
                    <div class="ov-header">
                      <el-tag type="warning" size="small">浮层 {{ oIndex + 1 }}</el-tag>
                      <el-button type="danger" link @click="deleteOverlay(img, oIndex)"><el-icon><Delete /></el-icon></el-button>
                    </div>

                    <el-tabs type="border-card" class="ov-tabs">
                      <!-- 基础 -->
                      <el-tab-pane label="内容基础">
                        <el-form label-width="100px" size="small">
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="类型 (type)">
                                <el-select v-model="ov.type" @change="handleTypeChange(ov)">
                                  <el-option label="小标签 (tag)" value="tag" />
                                  <el-option label="卡片 (card)" value="card" />
                                  <el-option label="主推卡片 (main)" value="main" />
                                </el-select>
                              </el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="坐标">
                                <span style="display:flex;gap:4px">
                                  X <el-input-number v-model="ov.pos.x" :min="0" :max="100" :precision="1" :controls="false" style="width:45%;"/>
                                  Y <el-input-number v-model="ov.pos.y" :min="0" :max="100" :precision="1" :controls="false" style="width:45%;"/>
                                </span>
                              </el-form-item>
                            </el-col>
                          </el-row>

                          <!-- 多态字段 -->
                          <div class="polymorphic-fields">
                            <template v-if="ov.type === 'tag'">
                              <el-form-item label="图标 (icon)"><el-input v-model="ov.icon" /></el-form-item>
                              <el-form-item label="标签名 (label)"><el-input v-model="ov.label" /></el-form-item>
                            </template>
                            <template v-else-if="ov.type === 'card' || ov.type === 'main'">
                              <el-form-item label="肩题 (eyebrow)"><el-input v-model="ov.eyebrow" /></el-form-item>
                              <el-form-item label="标题 (title)"><el-input v-model="ov.title" /></el-form-item>
                              <el-form-item label="描述 (desc)"><el-input type="textarea" v-model="ov.desc" :rows="2" /></el-form-item>
                              <el-form-item v-if="ov.type === 'main'" label="按钮"><el-input v-model="ov.btnText" /></el-form-item>
                            </template>
                          </div>
                        </el-form>
                      </el-tab-pane>

                      <!-- 动画 -->
                      <el-tab-pane label="动画配置">
                        <el-form label-width="100px" size="small">
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="入场动画">
                                <el-select v-model="ov.anim.type">
                                  <el-option label="Left→Right (slideX)" value="slideX_right" />
                                  <el-option label="Right→Left (slideX_rev)" value="slideX_left" />
                                  <el-option label="Bottom→Top (slideY)" value="slideY" />
                                  <el-option label="Fade In (渐隐显)" value="fade" />
                                  <el-option label="Zoom In (缩放)" value="zoom" />
                                  <el-option label="无动画" value="none" />
                                </el-select>
                              </el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="过渡曲线">
                                <el-select v-model="ov.anim.easing">
                                  <el-option label="平滑跟随 (ease)" value="ease" />
                                  <el-option label="弹性超调 (spring)" value="spring" />
                                  <el-option label="减速 (ease-out)" value="ease-out" />
                                  <el-option label="匀速 (linear)" value="linear" />
                                </el-select>
                              </el-form-item>
                            </el-col>
                          </el-row>
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="时长(ms)"><el-input-number v-model="ov.anim.duration" :step="50" style="width:100%"/></el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="延迟(ms)"><el-input-number v-model="ov.anim.delay" :step="50" style="width:100%"/></el-form-item>
                            </el-col>
                          </el-row>
                        </el-form>
                      </el-tab-pane>

                      <!-- 样式 -->
                      <el-tab-pane label="文字/背景样式">
                        <el-form label-width="100px" size="small">
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="主文本色">
                                <el-color-picker v-model="ov.style.color" show-alpha />
                              </el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="背景色">
                                <el-color-picker v-model="ov.style.bgColor" show-alpha />
                              </el-form-item>
                            </el-col>
                          </el-row>
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="字号(rpx)"><el-slider v-model="ov.style.fontSize" :min="18" :max="80" /></el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="字重">
                                <el-select v-model="ov.style.fontWeight">
                                  <el-option label="正常 (400)" value="400" />
                                  <el-option label="加粗 (700)" value="700" />
                                  <el-option label="特粗 (900)" value="900" />
                                </el-select>
                              </el-form-item>
                            </el-col>
                          </el-row>
                          <el-row :gutter="10">
                            <el-col :span="12">
                              <el-form-item label="背景毛玻璃">
                                <el-switch v-model="ov.style.bgBlur" />
                              </el-form-item>
                            </el-col>
                            <el-col :span="12">
                              <el-form-item label="显示阴影">
                                <el-switch v-model="ov.style.boxShadow" />
                              </el-form-item>
                            </el-col>
                          </el-row>
                        </el-form>
                      </el-tab-pane>
                    </el-tabs>

                  </div>

                  <div class="add-overlay-btn" style="text-align: center; margin-top: 10px;">
                    <el-button type="warning" plain size="small" @click="addOverlay(img)">
                      <el-icon><Plus /></el-icon> 添加动画浮层
                    </el-button>
                  </div>
                </el-card>

                <el-button type="primary" plain class="add-img-btn" @click="addImage(group)">
                  <el-icon><Picture /></el-icon> 添加新图片
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-main>

        <!-- 右侧：代码 / 预览区 -->
        <el-aside width="450px" class="right-panel">
          <el-tabs v-model="activeRightTab" class="right-tabs">
            <el-tab-pane label="实时预览 (可拖拽)" name="preview">
              <div class="preview-toolbar">
                <span>预览组：</span>
                <el-select v-model="previewGroupIndex" size="small" style="width:120px">
                  <el-option v-for="(g, idx) in configData.groups" :key="idx" :label="'Group ' + (idx+1)" :value="idx" />
                </el-select>
              </div>

              <!-- 手机壳模拟 -->
              <div class="phone-mockup">
                <!-- 全局鼠标事件监听，处理拖拽 -->
                <div class="phone-screen" 
                     @mousemove="onDragMove" 
                     @mouseup="onDragEnd" 
                     @mouseleave="onDragEnd">
                  
                  <div v-if="previewGroup" class="phone-content">
                    <div 
                      v-for="(img, iIndex) in previewGroup.images" 
                      :key="iIndex" 
                      class="preview-img-row"
                    >
                      <img :src="img.previewUrl || img.src || placeholderImg" class="p-img" draggable="false" @error="e => { if(e.target.src !== placeholderImg) e.target.src = placeholderImg; }" />
                      
                      <!-- 浮层渲染 -->
                      <div v-for="(ov, oIndex) in img.overlays" :key="oIndex"
                           class="p-fov"
                           :class="[ov.type]"
                           :style="getPreviewStyle(ov)"
                           @mousedown="onDragStart($event, ov)">
                         
                         <!-- tag 特有 -->
                         <div v-if="ov.type === 'tag'" class="p-tag-inner" :style="getInnerStyle(ov)">
                           <span class="p-icon">{{ov.icon}}</span>
                           <span class="p-txt">{{ov.label}}</span>
                         </div>
                         
                         <!-- card 特有 -->
                         <div v-else-if="ov.type === 'card'" class="p-card-inner" :style="getInnerStyle(ov)">
                           <div class="p-eyebrow">{{ov.eyebrow}}</div>
                           <div class="p-title">{{ov.title}}</div>
                           <div class="p-desc">{{ov.desc}}</div>
                         </div>
                         
                         <!-- main 特有 -->
                         <div v-else-if="ov.type === 'main'" class="p-main-inner" :style="getInnerStyle(ov)">
                           <div class="p-eyebrow">{{ov.eyebrow}}</div>
                           <div class="p-title">{{ov.title}}</div>
                           <div class="p-desc">{{ov.desc}}</div>
                           <div class="p-btn">{{ov.btnText}} →</div>
                         </div>
                      </div>

                    </div>
                  </div>
                  
                </div>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="JS 代码输出" name="code">
              <div class="json-tips">
                <el-icon><InfoFilled /></el-icon> 已转为 module.exports 格式，右上方点击导出即可。
              </div>
              <div class="json-preview-container">
                <pre class="json-content">{{ jsExportStr }}</pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-aside>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

// --- 初始占位图 ---
const placeholderImg = 'data:image/svg+xml;utf8,<svg width="375" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%23e0e0e0"/><text x="50%" y="50%" fill="%23aaa" font-family="sans-serif" font-size="20" text-anchor="middle" alignment-baseline="middle">本地无预览图，选择文件以预览</text></svg>'

// --- 默认模板工厂 ---
const createOverlay = (overrides = {}) => ({
  type: 'tag',
  pos: { x: 5, y: 15 },
  dir: 'left', // 保留向下兼容
  anim: { type: 'slideX_right', duration: 650, easing: 'spring', delay: 0 },
  style: { color: '#111111', fontSize: 28, fontWeight: '700', bgColor: 'rgba(255,255,255,0.93)', bgBlur: true, boxShadow: true },
  icon: '✨', label: '新特性',
  ...overrides
})

// --- 初始化数据 ---
const configData = reactive({
  groups: [
    {
      images: [
        {
          id: 'img0', src: '/assets/01.jpg', previewUrl: null,
          overlays: [createOverlay({ label: '全新型号', pos: {x:10, y:12} })],
        },
        {
          id: 'img1', src: '/assets/02.jpg', previewUrl: null,
          overlays: [createOverlay({ 
            type: 'card', pos: {x:40, y:30}, anim: { type:'slideX_left', duration:650, easing:'ease', delay:100 },
            eyebrow: '精选功能', title: '震撼视觉', desc: '超越以往的美学方案' 
          })],
        }
      ]
    }
  ]
})

const activeGroups = ref([0])
const activeRightTab = ref('preview')
const previewGroupIndex = ref(0)
const previewGroup = computed(() => configData.groups[previewGroupIndex.value])

// ---------- 组与图片操作 ----------
const addGroup = () => {
  configData.groups.push({ images: [] })
  activeGroups.value.push(configData.groups.length - 1)
}
const deleteGroup = (index) => { configData.groups.splice(index, 1) }

const generateUUID = () => 'img_' + Math.random().toString(36).substring(2, 6)

const addImage = (group) => {
  group.images.push({ id: generateUUID(), src: '/assets/placeholder.jpg', previewUrl: null, overlays: [] })
}

const deleteImage = (group, index) => { group.images.splice(index, 1) }

// ---------- 浮层操作 ----------
const addOverlay = (img) => { img.overlays.push(createOverlay()) }
const deleteOverlay = (img, index) => { img.overlays.splice(index, 1) }

const handleTypeChange = (ov) => {
  if (ov.type === 'tag') {
    if (!ov.icon) ov.icon = '✨'
    if (!ov.label) ov.label = '新标签'
  } else if (ov.type === 'card' || ov.type === 'main') {
    if (!ov.title) ov.title = '请输入标题'
    if (!ov.desc) ov.desc = '请输入描述'
  }
}

// 本地图片预览
const handleLocalImage = (e, img) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    img.previewUrl = url;
  }
}

// ---------- 拖拽预览逻辑 ----------
let dragTarget = null;
let startX = 0;
let startY = 0;
let initialPosX = 0;
let initialPosY = 0;
let parentW = 0;
let parentH = 0;

const onDragStart = (e, ov) => {
  e.preventDefault();
  dragTarget = ov;
  startX = e.clientX;
  startY = e.clientY;
  initialPosX = ov.pos.x;
  initialPosY = ov.pos.y;
  
  const parentEl = e.target.closest('.preview-img-row');
  if (parentEl) {
    const rect = parentEl.getBoundingClientRect();
    parentW = rect.width;
    parentH = rect.height;
  }
}

const onDragMove = (e) => {
  if (!dragTarget || !parentW || !parentH) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  
  let newX = initialPosX + (dx / parentW) * 100;
  let newY = initialPosY + (dy / parentH) * 100;
  
  dragTarget.pos.x = Math.max(0, Math.min(100, Number(newX.toFixed(1))));
  dragTarget.pos.y = Math.max(0, Math.min(100, Number(newY.toFixed(1))));
}

const onDragEnd = () => {
  dragTarget = null;
}

// 预览样式映射
const getPreviewStyle = (ov) => {
  return {
    left: ov.pos.x + '%',
    top: ov.pos.y + '%',
    cursor: dragTarget === ov ? 'grabbing' : 'grab'
  }
}

const getInnerStyle = (ov) => {
  const s = ov.style || {};
  return {
    color: s.color,
    fontSize: (s.fontSize / 2.6) + 'px', // 模拟 rpx 缩放
    fontWeight: s.fontWeight,
    backgroundColor: s.bgColor,
    backdropFilter: s.bgBlur ? 'blur(10px)' : 'none',
    boxShadow: s.boxShadow === false ? 'none' : ''
  }
}

// ---------- JS 导出逻辑 ----------
const stripPreviewData = (data) => {
  // 深拷贝并去除不需要的字段 (如 previewUrl)
  const copy = JSON.parse(JSON.stringify(data));
  copy.groups.forEach(g => {
    g.images.forEach(img => {
      delete img.previewUrl;
    })
  });
  return copy;
}

const jsExportStr = computed(() => {
  const cleanData = stripPreviewData(configData);
  const jsonStr = JSON.stringify(cleanData, null, 2);
  return `// 此文件由 WeChat Detail Editor 自动生成
// 使用 module.exports 导出以供小程序直接 require()

module.exports = ${jsonStr};
`;
})

const downloadJs = () => {
  const fileStr = jsExportStr.value;
  const blob = new Blob([fileStr], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'productConfig.js';
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  ElMessage.success('成功导出 productConfig.js！');
}

</script>

<style scoped>
.full-height {
  height: 100vh;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #2b2f3a;
  color: white;
  padding: 0 20px;
}
.logo {
  font-size: 20px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
}
.main-body {
  height: calc(100vh - 60px);
  overflow: hidden;
}
.left-panel {
  padding: 20px;
  background-color: #fff;
  border-right: 1px solid #ebeef5;
}
.right-panel {
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}
.right-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}
:deep(.right-tabs > .el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}
:deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

/* 组/图片样式 */
.collapse-title { display: flex; align-items: center; width: 100%; padding-right: 15px; }
.img-count { margin-left: 15px; font-size: 13px; color: #909399; }
.delete-btn { margin-left: auto; }
.group-content { padding: 10px; background-color: #f8f9fa; border-radius: 8px; }
.img-card { margin-bottom: 15px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.add-img-btn { width: 100%; margin-top: 10px; }

/* 浮层动画配置区 */
.overlay-box { background-color: #f9fbfd; border: 1px solid #dcdfe6; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
.ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ov-tabs { border: none !important; box-shadow: none !important; }
.polymorphic-fields { background-color: white; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px dashed #e4e7ed;}

/* JSON 预览区 */
.json-preview-container { flex: 1; overflow: auto; padding: 15px; background-color: #1e1e1e; }
.json-content { margin: 0; color: #d4d4d4; font-family: Consolas, Monaco, monospace; font-size: 13px; }
.json-tips { padding: 10px 15px; background-color: #ecf5ff; color: #409eff; font-size: 13px; border-bottom: 1px solid #d9ecff; }

/* 手机壳模拟区 */
.preview-toolbar { padding: 10px; text-align: center; background: white; border-bottom: 1px solid #e4e7ed; }
.phone-mockup { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 30px; background-color: #e4e7ed; }
.phone-screen {
  width: 375px; 
  background: black; 
  box-shadow: 0 20px 40px rgba(0,0,0,0.2); 
  border-radius: 30px; 
  overflow: hidden; 
  position: relative;
  /* Disable text selection while dragging */
  user-select: none;
}
.phone-content { height: 100%; overflow: auto; }
.phone-content::-webkit-scrollbar { width: 0; }

.preview-img-row { position: relative; width: 100%; line-height: 0; }
.p-img { width: 100%; display: block; }
.p-fov { position: absolute; z-index: 10; pointer-events: auto; }

/* 预览版浮层基础样式 */
.p-tag-inner {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 14px; border-radius: 30px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  white-space: nowrap;
}
.p-card-inner {
  width: 140px; padding: 14px; border-radius: 12px;
  box-shadow: 0 6px 15px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; gap: 6px;
  line-height: 1.4;
}
.p-main-inner {
  width: 260px; padding: 20px; border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
}
.p-title { font-weight: 800; font-size: 1.1em;}
.p-eyebrow { font-size: 0.6em; opacity: 0.5; letter-spacing: 2px;}
.p-desc { font-size: 0.7em; opacity: 0.8; }
.p-btn { margin-top: 8px; padding: 8px 24px; border-radius: 20px; background: #333; color: white; font-size: 0.8em; font-weight: bold; }

</style>
