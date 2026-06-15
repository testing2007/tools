# WebAR Curved Surface Tracking — CurveTrace

基于 OpenCV.js + Three.js + solvePnP 的实时瓶贴曲面追踪引擎，支持在圆柱形瓶体标签上叠加 AR 视频。

---

## 快速启动

### 1. 启动本地服务器

```shell
node compile-server.js --serve
```

### 2. 打开客户端

```
http://localhost:4000/impl.html
```

> 需要 HTTPS 或 localhost 才能访问摄像头（浏览器安全限制）。

---

## 项目结构

```
curveTrace/
├── impl.html           # 主客户端（AR 渲染 + UI 控制面板）
├── cv-worker.js        # Web Worker：所有 OpenCV 追踪逻辑
├── compile-server.js   # 本地静态文件服务器
├── assets/
│   ├── mark.jpg        # 参考标签图（训练 ORB 特征点）
│   └── bottle.glb      # 瓶体 3D 模型（含 labelMesh + bottleMesh）
├── libs/
│   ├── three.module.js
│   ├── GLTFLoader.js
│   └── OrbitControls.js
└── doc/                # 补充文档
```

---

## 系统架构

### 总体流程

```
摄像头帧
  │
  ▼
cv-worker.js (Web Worker)
  ├─ ORB 特征检测 / 描述符匹配
  ├─ Lucas-Kanade 光流追踪
  ├─ solvePnP 位姿估算
  └─ 输出: 相机位置 + 四元数
  │
  ▼
impl.html (主线程)
  ├─ Three.js 渲染场景
  ├─ 根据 solvePnP 位姿摆放 bottle.glb 模型
  └─ AR 视频贴合瓶体标签曲面
```

### 线程职责分离

| 模块                    | 职责                                                    |
| ----------------------- | ------------------------------------------------------- |
| `impl.html` (主线程)    | UI、Three.js 渲染、GLB 加载、摄像头视频流、位姿应用     |
| `cv-worker.js` (Worker) | OpenCV 运算、ORB 特征提取、KNN 匹配、光流追踪、PnP 求解 |

通过 `postMessage` 通信，主线程发送原始像素帧，Worker 返回位姿结果，避免主线程卡顿。

---

## 核心算法

### 1. 参考图层（Multi-Scale Reference Levels）

Worker 在加载 `mark.jpg` 后，按 6 个尺度（1.0 / 0.75 / 0.5 / 0.35 / 0.25 / 0.18）构建参考图层，每个尺度同时生成正向和**镜像**版本：

- **镜像图层**专为前置摄像头设计：前置摄像头输出水平翻转图像，镜像图层用于匹配非对称特征（如标签文字）。
- 镜像图层发送 3D 点时，U 坐标翻转处理确保 3D 位置正确。

```js
// cv-worker.js
buildRefLevel(scaledGray, scale, scaledW, scaledH, false); // 正常图层
cv.flip(scaledGray, mirroredGray, 1);
buildRefLevel(mirroredGray, scale, scaledW, scaledH, true); // 镜像图层
```

### 2. UV → 3D 坐标映射（解析圆柱模型）

#### 形状参数（来自用户滑动条）

```
R         = radiusTopMm / 1000          单位：米
halfAngle = labelWidthMm(弧长) / (2×R)  单位：弧度
labelH    = labelHeightMm / 1000        单位：米
```

#### 位置锚点（来自 bottle.glb AABB）

```
axisX   = labelMesh 边界盒 X 中心（圆柱轴心 X）
centerY = labelMesh 边界盒 Y 中心（标签垂直中心）
frontZ  = labelMesh 边界盒 maxZ（弧面最前点）
axisZ   = frontZ - R（圆柱轴心 Z，应≈0 若瓶子在原点）
```

#### 解析公式

```
theta = -halfAngle + u × (2×halfAngle)
y     = yTop - v × (yTop - yBot)
x     = axisX + R × sin(theta)
z     = axisZ + R × cos(theta)
```

### 3. 追踪状态机

```
SCANNING ──(ORB 重定位成功)──▶ TRACKING
TRACKING ──(光流失败)──────▶ SCANNING
```

- **SCANNING**：每隔 `orbRelocalizeInterval` 帧触发全图 ORB 匹配 + solvePnP
- **TRACKING**：Lucas-Kanade 光流稳定跟踪，低延迟
- `relocalizePersistence`：重定位成功后保持追踪状态的最长时间（ms）

### 4. 位姿平滑

Worker 中维护上一帧的相机位置和四元数，检测追踪跳变（位置突变或旋转突变），避免姿态抖动。

---

## Calibration Panel（校准面板）

运行时通过右侧滑动控制面板调整所有参数，**配置自动持久化到 LocalStorage**。

### 📐 Physical Dimensions（物理尺寸）

> **最重要的参数区**：决定 UV→3D 映射的准确性。

| 参数                        | 含义                   | 默认值 |
| --------------------------- | ---------------------- | ------ |
| 弧长 Label Arc Length (mm)  | 标签在瓶面上的水平弧长 | 56     |
| 高度 Label Height (mm)      | 标签高度               | 88     |
| 半径 R (mm)                 | 标签区域圆柱半径       | 35     |
| 底部半径 Radius Bottom (mm) | 瓶底部半径（锥形瓶用） | 35     |

**推导信息（自动显示）：**

| 显示项            | 含义                          |
| ----------------- | ----------------------------- |
| 半弧角 halfAngle  | 弧长÷(2×R)，附带公式          |
| 标签中心Y centerY | 从 GLB AABB 提取              |
| 弧面前点Z frontZ  | 从 GLB AABB 提取              |
| 圆柱轴Z axisZ     | = frontZ−R，≈0 表示瓶子在原点 |

### 📡 Tracking Response

| 参数           | 含义                                         |
| -------------- | -------------------------------------------- |
| Responsiveness | 追踪响应速度，0=零延迟，越高越平滑但延迟更大 |

### 🎯 Detection Sensitivity

| 参数           | 含义                                 |
| -------------- | ------------------------------------ |
| Min Matches    | 重定位所需的最小匹配点数             |
| Hamming Cutoff | ORB 描述符最大汉明距离（越小越严格） |

### 📷 Camera Intrinsics

| 参数                      | 含义                           |
| ------------------------- | ------------------------------ |
| fx Scale (horiz focal)    | 水平焦距缩放比                 |
| fy Scale (vert focal)     | 垂直焦距缩放比                 |
| cx Ratio (principal pt X) | 主点 X 比例（相对图像宽度）    |
| cy Ratio (principal pt Y) | 主点 Y 比例（相对图像高度）    |
| Lost Persistence          | 追踪丢失后保持显示的时长（ms） |
| Max Frame Features        | ORB 最大特征点数               |

---

## bottle.glb 规范

### 王老吉目标约束

- `assets/wanglaoji/mark.jpg` 的物理展开尺寸为 `207mm × 105mm`。
- `labelMesh` 使用整圈平面 UV，视频直接复用该网格和 UV，不再创建独立平面或解析圆柱。
- 加载时以 `bottleMesh` 的轴心和半径为基准，将 `labelMesh` 高度校准为 `105mm`，并保留约 `0.05mm` 的表面间隙以避免深度闪烁。
- 校准后的同一份 `labelMesh` 几何同时用于 OpenCV PnP 的 UV→3D 对应点和 Three.js 视频渲染，避免识别模型与播放模型不一致。
- Live AR 会使用不可见的 `bottleMesh` 深度遮挡体，使视频按瓶体表面遮挡关系渲染。

### 视频表面贴合调节

- `Depth Offset (mm)` 沿 `labelMesh` 顶点法线移动视频表面，正值向瓶外移动，负值向瓶内贴近。
- `Video Width` 与 `Video Height` 始终按相同比例联动，缩放视频时不会改变原始宽高比。
- 缩放仅改变视频在标签 UV 上的显示区域，不改变 OpenCV PnP 使用的识别几何。
- `Reset Video` 只重置视频深度和显示比例，不影响相机内参、识别阈值等其他校准参数。

### 必须包含的网格

| 网格名       | 作用                                         |
| ------------ | -------------------------------------------- |
| `labelMesh`  | 标签曲面，必须有正确的 UV 贴图，位置决定锚点 |
| `bottleMesh` | 瓶体（用于渲染显示，不影响追踪）             |

### 建模要求

1. **单位：米（meter）**。`labelMesh` 弧宽约 55mm → AABB x ≈ 0.055
2. **labelMesh 和 bottleMesh 均放置在世界原点（0,0,0）附近**
3. `labelMesh` 的 UV(0,0) 对应标签左上角（或右上角，系统会自动检测 uFlip 方向）
4. `frontZ`（labelMesh AABB maxZ）减去 R 应约等于 0（即圆柱轴心在 Z=0）

### 诊断日志

GLB 加载后控制台会输出：

```
[GLB Diag] labelMesh AABB size: {x, y, z} | center | sphere radius
[CylParams] 位置锚点: axisX centerY frontZ
[CylParams] UV方向: uFlip vFlip
[CylParams] 配置形状 (来自滑动条): R halfAngle 高度
```

---

## 前置摄像头处理

前置摄像头（selfie camera）输出水平镜像图像，系统通过以下方式处理：

1. **CSS `scaleX(-1)`**：背景视频显示镜像，用户看到"镜子效果"
2. **Worker 镜像图层**：为镜像图像专门构建参考图层，实现文字等非对称特征的匹配
3. **纹理 U 翻转**：Three.js 视频贴图 `repeat.x = -1`，与 CSS 镜像方向保持一致

---

## 依赖

| 库         | 版本  | 加载方式                       |
| ---------- | ----- | ------------------------------ |
| OpenCV.js  | 4.5.5 | CDN（Worker 内 importScripts） |
| Three.js   | r160+ | 本地（`libs/three.module.js`） |
| GLTFLoader | r160+ | 本地（`libs/GLTFLoader.js`）   |

---

## 调试技巧

### 检查匹配质量

打开浏览器控制台，观察：

```
[Worker] Ref scale 1 mirrored: 480 kps (640x480)
[Worker] ORB: X matches → PnP OK (Npt inliers)
```

### 调整 AR 贴合位置

若 AR 贴图偏移：

1. 先确认 `R (mm)` 与实际瓶子半径一致
2. 确认 `Label Arc Length (mm)` 与实际标签弧长一致
3. 查看 `axisZ` 是否 ≈ 0（若不为0说明 GLB 建模偏移）

### 追踪不稳定

- 降低 `Hamming Cutoff`（更严格匹配）
- 提高 `Min Matches`
- 确保标签光照均匀，避免强反光

---

## 开发历史摘要

| 阶段    | 主要工作                                                              |
| ------- | --------------------------------------------------------------------- | -------------------------------------- |
| Phase 1 | 平面 ORB 追踪基础框架（主线程 OpenCV）                                |
| Phase 2 | Web Worker 化，消除主线程卡顿                                         |
| Phase 3 | 圆柱解析模型替代平面假设，UV→圆柱面 3D 映射                           |
| Phase 4 | GLB 模型集成：从 Blender 导出瓶体几何，提取位置锚点                   |
| Phase 5 | 多尺度参考图层 + 前置摄像头镜像图层                                   | （资源上并没有多尺度，代码也许提供了） |
| Phase 6 | 物理参数滑动条 UI，用户可实时调整弧长/半径/高度                       |
| Phase 7 | 参数派生显示面板：自动计算并展示 halfAngle / centerY / frontZ / axisZ |
