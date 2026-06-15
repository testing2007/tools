# AR 王老吉罐追踪 — 实现计划

## 目标

用浏览器摄像头实时识别王老吉罐标签（`mark.jpg`），通过 OpenCV WASM `solvePnP` 估算姿态，
然后用 Three.js 将 `bottle.glb` 精准叠加到真实罐体上，并在 `labelMesh` 上播放 `attach.mp4`。

---

## 技术选型

| 模块 | 方案 |
|---|---|
| 特征检测 | OpenCV WASM **ORB** (速度快，WASM 版本必有) |
| 特征匹配 | **BFMatcher + Hamming** + Lowe's ratio test (0.75) |
| 姿态估计 | **solvePnP** + RANSAC（抗误匹配干扰）|
| 3D 渲染 | **Three.js** + GLTFLoader |
| 视频贴图 | Three.js **VideoTexture** → labelMesh.material.map |
| 相机内参 | **估算法**（无标定）|

---

## 关键技术细节

### 1. 相机内参估算（无标定）

标定工具麻烦，用「经验公式」估算，误差在可接受范围内：

```
fx = fy ≈ image_width * 1.0   (适用于约60°水平视角的普通摄像头)
cx = image_width / 2
cy = image_height / 2
```

提供 UI 滑块让用户实时调整 `fx`，以便快速校准。

### 2. 3D 物点坐标（mark.jpg 实际物理尺寸）

标签尺寸：**207mm × 105mm**，以标签中心为原点建立物体坐标系：

```
ORB 特征点 (px, py) 在标签图像 (W × H 像素) 中的位置
→ 3D 物点：
  X = (px / W - 0.5) * 207   [mm]
  Y = (0.5 - py / H) * 105   [mm]  (Y 轴朝上，与OpenCV Y朝下相反)
  Z = 0
```

### 3. 坐标系转换（OpenCV → Three.js）

| | X | Y | Z |
|---|---|---|---|
| OpenCV 相机系 | 右 | **朝下** | 朝相机前方（景深）|
| Three.js 相机系 | 右 | **朝上** | 朝屏幕外（朝向观察者）|

solvePnP 输出的 `rvec`, `tvec` 在 OpenCV 相机坐标系下，转换到 Three.js 矩阵：

```js
// 翻转矩阵 F = diag(1, -1, -1)
// R_threejs = F * R_opencv
// t_threejs = F * t_opencv
// 即：R/t 的 Y、Z 分量取反

const modelMatrix = new THREE.Matrix4();
// 从 rvec 得到旋转矩阵 R (3x3)
// 构建 4x4:
// [  R[0][0],  R[0][1],  R[0][2],  t[0] ]
// [ -R[1][0], -R[1][1], -R[1][2], -t[1] ]  ← Y 取反
// [ -R[2][0], -R[2][1], -R[2][2], -t[2] ]  ← Z 取反
// [        0,         0,        0,      1 ]
```

Three.js Matrix4 是列主序存储，需要转置。

### 4. bottle.glb 朝向对齐

用户说明：**逆时针水平旋转 45°** 是文字正面。  
这意味着：模型 默认朝向 比 "标签正面" 多转了 45°（或差了 45°）。

solvePnP 检测到标签平面后，模型需要额外绕 Y 轴旋转来对齐：

```js
// 在物体坐标系下预旋转
const preRotation = new THREE.Matrix4().makeRotationY(Math.PI / 4); // +45° 或 -45°
// 最终矩阵 = poseMatrix * preRotation
```

> ⚠️ 具体是 +45° 还是 -45° 需运行时目视确认，代码提供实时调整滑块。

### 5. labelMesh 视频纹理

```js
// attach.mp4 → VideoTexture → labelMesh.material.map
const video = document.createElement('video');
video.src = 'assets/wanglaoji/attach.mp4';
video.loop = true;
video.muted = true;
video.play();
const videoTexture = new THREE.VideoTexture(video);
labelMesh.material.map = videoTexture;
labelMesh.material.needsUpdate = true;
```

> 用户思路是对的：labelMesh 本身就是 mark.jpg 的平面 UV 表达，用它来承载视频追踪结果精准度最高。

### 6. 单位换算

solvePnP 输出的 tvec 单位与 3D 物点单位一致（这里是 mm）。  
Three.js 通常用"无单位"（1 unit），需要换算：

```js
// GLB 模型大概多大？需要检查 bottle.glb 的实际尺寸后决定缩放
// 初始方案：tvec 单位 mm，Three.js 设置 1 unit = 1 mm
// 相机的 near/far 范围相应设大一点
```

---

## Open Questions

> [!IMPORTANT]
> **bottle.glb 旋转方向确认**：用户说"逆时针水平旋转45°是文字正面"，但这是从俯视角度看还是正视角？我在代码中提供 UI 滑块，方便实时调整，无需重新构建。

> [!NOTE]
> **焦距调整**：无标定的情况下，焦距估算误差可能导致模型比例或位置偏差，UI 上提供 focal length 滑块，实时调整效果。

---

## 实现文件结构

```
solvePnPPrj/
├── index.html          ← 主页面（新建）
├── js/
│   ├── main.js         ← 主逻辑（新建）
│   ├── arTracker.js    ← OpenCV ORB + solvePnP 封装（新建）
│   └── arRenderer.js   ← Three.js 场景 + 姿态更新（新建）
├── assets/wanglaoji/   ← 现有
└── libs/               ← 现有
```

---

## 实现步骤

### Phase 1: 基础页面
- [ ] 创建 `index.html`：视频背景 + Three.js canvas 叠加
- [ ] 初始化摄像头
- [ ] 加载并展示 `bottle.glb`（OrbitControls 测试）

### Phase 2: 特征检测
- [ ] 创建 `arTracker.js`
- [ ] 加载 `mark.jpg`，提取 ORB 特征（离线，只做一次）
- [ ] 每帧检测当前画面 ORB 特征
- [ ] BFMatcher + ratio test 匹配

### Phase 3: solvePnP + 坐标转换
- [ ] 构建 3D 物点坐标（mm 单位）
- [ ] solvePnP + RANSAC 姿态估计
- [ ] 坐标系转换 → Three.js Matrix4

### Phase 4: 渲染对齐
- [ ] 创建 `arRenderer.js`
- [ ] 每帧更新 bottle 模型 matrix
- [ ] 应用 45° 预旋转对齐
- [ ] `attach.mp4` 作为 VideoTexture 贴到 labelMesh

### Phase 5: UI 调试工具
- [ ] 焦距 `fx` 调整滑块
- [ ] 预旋转角度滑块
- [ ] 特征匹配点可视化（debug 模式）
- [ ] FPS 显示

---

## 验证方案

1. 启动本地服务器（`python -m http.server` 或 VS Code Live Server）
2. 打开摄像头，对准 mark.jpg 图像（屏幕显示或打印）
3. 观察 bottle.glb 模型是否随镜头移动正确叠加
4. 检查 labelMesh 是否正确播放视频
5. 调整焦距/旋转滑块精调对齐
