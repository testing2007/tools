<template>
  <div class="editor-container">
    <el-container class="full-height">
      <!-- 头部 -->
      <el-header height="60px" class="header">
        <div class="logo">
          <el-icon><Monitor /></el-icon>
          微信小程序详情页配置台
        </div>
        <div class="actions">
          <el-button type="primary" @click="downloadJson">
            <el-icon><Download /></el-icon> 导出 JSON (保存到本地)
          </el-button>
        </div>
      </el-header>

      <el-container class="main-body">
        <!-- 左侧：表单配置区 -->
        <el-main class="left-panel">
          <div class="panel-header">
            <h3>页面配置结构树</h3>
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
                  <!-- 点击删除按钮时阻止折叠事件冒泡 -->
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
                  <el-form label-width="100px">
                    <el-form-item label="标识符 (ID)">
                      <el-input v-model="img.id" placeholder="唯一标识，用于动画 (如 img0)" />
                    </el-form-item>
                    <el-form-item label="资源路径">
                      <el-input v-model="img.src" placeholder="填写路径如 /assets/01.jpg" />
                    </el-form-item>
                  </el-form>

                  <el-divider>所属浮层动画 ({{ img.overlays.length }})</el-divider>

                  <!-- 图片上的浮层列表 -->
                  <div 
                    v-for="(ov, oIndex) in img.overlays" 
                    :key="oIndex" 
                    class="overlay-box"
                  >
                    <div class="ov-header">
                      <el-tag type="warning" size="small">浮层 {{ oIndex + 1 }}</el-tag>
                      <el-button type="danger" link @click="deleteOverlay(img, oIndex)"><el-icon><Delete /></el-icon></el-button>
                    </div>

                    <el-form label-width="100px" size="small">
                      <el-row :gutter="10">
                        <el-col :span="8">
                          <el-form-item label="浮层类型">
                            <el-select v-model="ov.type" placeholder="选择类型" @change="handleTypeChange(ov)">
                              <el-option label="小标签 (tag)" value="tag" />
                              <el-option label="信息卡片 (card)" value="card" />
                              <el-option label="主推卡片 (main)" value="main" />
                            </el-select>
                          </el-form-item>
                        </el-col>
                        <el-col :span="8">
                          <el-form-item label="锚点位置">
                            <el-select v-model="ov.anchor">
                              <el-option label="左上方" value="top-left" />
                              <el-option label="右上方" value="top-right" />
                              <el-option label="左侧居中" value="mid-left" />
                              <el-option label="右侧居中" value="mid-right" />
                              <el-option label="底部居中" value="bot-center" />
                            </el-select>
                          </el-form-item>
                        </el-col>
                        <el-col :span="8">
                          <el-form-item label="飞入方向">
                            <el-select v-model="ov.dir">
                              <el-option label="从左侧入" value="left" />
                              <el-option label="从右侧入" value="right" />
                              <el-option label="从底下入" value="bottom" />
                            </el-select>
                          </el-form-item>
                        </el-col>
                      </el-row>

                      <!-- 多态字段展示区 -->
                      <div class="polymorphic-fields">
                        <template v-if="ov.type === 'tag'">
                          <el-form-item label="图标 (icon)"><el-input v-model="ov.icon" placeholder="比如: ✨" /></el-form-item>
                          <el-form-item label="标签名 (label)"><el-input v-model="ov.label" placeholder="全新登场" /></el-form-item>
                        </template>

                        <template v-else-if="ov.type === 'card' || ov.type === 'main'">
                          <el-form-item label="肩题 (eyebrow)"><el-input v-model="ov.eyebrow" placeholder="小字介绍" /></el-form-item>
                          <el-form-item label="标题 (title)"><el-input v-model="ov.title" placeholder="大字标题" /></el-form-item>
                          <el-form-item label="描述 (desc)">
                            <el-input type="textarea" v-model="ov.desc" :rows="2" placeholder="长文案描述" />
                          </el-form-item>
                          <!-- type === 'main' 独有字段 -->
                          <el-form-item v-if="ov.type === 'main'" label="按钮文案">
                            <el-input v-model="ov.btnText" placeholder="探索产品" />
                          </el-form-item>
                        </template>
                      </div>
                    </el-form>
                  </div> <!-- /overlay-box -->

                  <!-- 新增浮层按钮 -->
                  <div class="add-overlay-btn" style="text-align: center; margin-top: 10px;">
                    <el-button type="warning" plain size="small" @click="addOverlay(img)">
                      <el-icon><Plus /></el-icon> 为此图片添加动画浮层
                    </el-button>
                  </div>
                </el-card>

                <!-- 新增图片按钮 -->
                <el-button type="primary" plain class="add-img-btn" @click="addImage(group)">
                  <el-icon><Picture /></el-icon> 添加新图片
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-main>

        <!-- 右侧：代码 / 预览区 -->
        <el-aside width="400px" class="right-panel">
          <div class="panel-header">
            <h3>JSON 数据输出 (实时预览)</h3>
          </div>
          <div class="json-preview-container">
            <pre class="json-content">{{ formattedJson }}</pre>
          </div>
          <div class="json-tips">
            <p><el-icon><InfoFilled /></el-icon> 配置结束后，使用右上角的“导出 JSON”按钮保存文件。</p>
            <p>将导出的文件覆盖小程序 <code>data/productConfig.json</code> 即可生效！</p>
          </div>
        </el-aside>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

// 初始化默认的小程序配置数据结构（模拟数据）
const configData = reactive({
  groups: [
    {
      images: [
        {
          id: 'img0', src: '/assets/01.jpg',
          overlays: [{ type: 'tag', dir: 'left', anchor: 'top-left', icon: '✨', label: '全新登场' }],
        },
        {
          id: 'img1', src: '/assets/02.jpg',
          overlays: [{ type: 'card', dir: 'right', anchor: 'mid-right', eyebrow: '精选功能', title: '震撼视觉', desc: '超越以往的美学方案，带来极致体验' }],
        },
        {
          id: 'img2', src: '/assets/03.jpg',
          overlays: [{ type: 'tag', dir: 'bottom', anchor: 'bot-center', icon: '🚀', label: '性能狂飙' }],
        },
      ],
    },
    {
      images: [
        {
          id: 'img3', src: '/assets/04.jpg',
          overlays: [{ type: 'card', dir: 'left', anchor: 'mid-left', eyebrow: '核心优势', title: '坚若磐石', desc: '创新材料架构，经久耐用' }],
        },
        {
          id: 'img4', src: '/assets/05.jpg',
          overlays: [{ type: 'tag', dir: 'right', anchor: 'top-right', icon: '🔋', label: '持久续航' }],
        },
        {
          id: 'img5', src: '/assets/06.jpg',
          overlays: [{ type: 'main', dir: 'bottom', anchor: 'bot-center', eyebrow: '立即了解', title: '立即体验', desc: '感受更多不凡之处', btnText: '探索产品' }],
        },
      ],
    }
  ]
})

// 默认展开所有折叠面板
const activeGroups = ref([0, 1])

// ---------- 组操作 ----------
const addGroup = () => {
  configData.groups.push({ images: [] })
  activeGroups.value.push(configData.groups.length - 1)
}

const deleteGroup = (index) => {
  configData.groups.splice(index, 1)
}

// ---------- 图片操作 ----------
// 为了生成唯一的 ID，简单使用时间戳或者随机数
const generateUUID = () => 'img_' + Math.random().toString(36).substring(2, 8)

const addImage = (group) => {
  group.images.push({
    id: generateUUID(),
    src: '/assets/placeholder.jpg',
    overlays: []
  })
}

const deleteImage = (group, index) => {
  group.images.splice(index, 1)
}

// ---------- 浮层操作 ----------
const addOverlay = (img) => {
  img.overlays.push({
    type: 'tag',
    dir: 'left',
    anchor: 'top-left',
    icon: '✨',
    label: '新特性'
  })
}

const deleteOverlay = (img, index) => {
  img.overlays.splice(index, 1)
}

// 浮层类型切换时，保证属性匹配（虽然无关属性存在也不会影响 JSON 使用，为了严谨可以清理）
const handleTypeChange = (ov) => {
  if (ov.type === 'tag') {
    if (!ov.icon) ov.icon = '✨'
    if (!ov.label) ov.label = '新标签'
  } else if (ov.type === 'card' || ov.type === 'main') {
    if (!ov.title) ov.title = '请输入标题'
    if (!ov.desc) ov.desc = '请输入描述'
  }
}

// ---------- JSON 显示与下载 ----------
const formattedJson = computed(() => {
  return JSON.stringify(configData, null, 2)
})

const downloadJson = () => {
  const jsonStr = JSON.stringify(configData, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'productConfig.json'
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  ElMessage.success('成功导出 productConfig.json！')
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
  background-color: #fcfcfc;
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

/* 组与折叠面版样式 */
.collapse-title {
  display: flex;
  align-items: center;
  width: 100%;
  padding-right: 15px;
}
.img-count {
  margin-left: 15px;
  font-size: 13px;
  color: #909399;
}
.delete-btn {
  margin-left: auto;
}
.group-content {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

/* 图片卡片样式 */
.img-card {
  margin-bottom: 15px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.add-img-btn {
  width: 100%;
  margin-top: 10px;
}

/* 浮层动画配置区 */
.overlay-box {
  background-color: #f0f4ff;
  border: 1px dashed #b3c0d1;
  border-radius: 6px;
  padding: 15px 15px 0 15px;
  margin-bottom: 12px;
}
.ov-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.polymorphic-fields {
  background-color: white;
  padding: 10px 10px 5px 10px;
  border-radius: 4px;
  margin-top: 10px;
  margin-bottom: 15px;
}

/* JSON 预览区 */
.json-preview-container {
  flex: 1;
  overflow: auto;
  padding: 15px;
  background-color: #1e1e1e;
}
.json-content {
  margin: 0;
  color: #d4d4d4;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
}
.json-tips {
  padding: 15px;
  background-color: #ecf5ff;
  color: #409eff;
  font-size: 13px;
  border-top: 1px solid #d9ecff;
}
.json-tips p {
  margin: 5px 0;
}
</style>
