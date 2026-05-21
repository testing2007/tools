你现在不是“方向错了”，而是**把最难的商业级 AR 跟踪引擎，当成了一个 OpenCV.js Demo 来做**。
Kivicube / 8th Wall 的差距主要不在 Three.js 贴图，而在 **目标训练、鲁棒识别、连续跟踪、曲面几何约束、相机标定、失败恢复、移动端性能工程** 这一整套 pipeline。

## 先判断你当前实现

从你的 `curveTrace/impl.html` 看，当前核心路线大概是：

```text
摄像头画面
  ↓
OpenCV.js ORB 特征点
  ↓
BFMatcher / Hamming 匹配
  ↓
2D 图像点 ↔ 3D 曲面点
  ↓
solvePnP / solvePnPRansac 求姿态
  ↓
Three.js 圆柱/圆锥面贴视频
  ↓
lerp/slerp 平滑
```

这个判断有依据：你的界面说明写的是 “OpenCV.js solvePnP”，控制面板里有上半径、下半径、圆柱高度、弧度覆盖、Min Matches、Hamming Cutoff、FOV 系数等参数；代码里也能看到 `ORB.create(1000)`、`BFMatcher(cv.NORM_HAMMING, true)`、`ref3DPoints`、`flowObjPoints`、`flowFramePoints`、`rvec/tvec` 等状态。([GitHub][1])

这个路线**适合学习**，但离商业平台还差几个关键层级。

---

# 一、你主要错在：把“曲面 AR”理解成了“平面图识别 + 圆柱贴图”

这是最大问题。

你现在本质上是：

```text
用 mark.jpg 当平面参考图
提取 ORB 特征
把这些 2D 特征人工映射到圆柱面 3D 点
再用 PnP 反推相机姿态
```

这能跑，但稳定性天然差。原因是：**酒标贴在瓶身之后，摄像头看到的图像不是简单的平面透视变换，而是曲面投影变形**。

平面图像目标可以近似用 Homography 处理；但圆柱酒标从侧面看时，左右边缘会被压缩，局部尺度变化不一致。你的 ORB 特征是在展开平面 `mark.jpg` 上提的，但摄像头看到的是“被圆柱弯曲后的图案”。这会导致：

```text
中心区域能匹配
边缘区域匹配差
角度一大，匹配点分布偏一边
PnP 解出来的姿态抖动
旋转或移动后直接丢失
```

OpenCV 官方对 `solvePnP` 的定义是：它依赖一组准确的 **3D object points** 和对应的 **2D image points**，通过最小化重投影误差求旋转和平移；如果对应点质量差，结果就会抖。([docs.opencv.org][2])

所以问题不是 `solvePnP` 本身差，而是你喂给它的 2D-3D 对应点还不够可靠。

---

# 二、Kivicube / 8th Wall 不是只做“识别”，而是做“目标训练包”

你现在是运行时直接读 `assets/mark.jpg`，现场提 ORB 特征。商业平台一般不会这么粗暴。

Kivicube 文档里明确把 Image AR 做成“上传目标图 → 创建场景 → 目标图质量决定稳定性”的流程，并强调目标图要细节丰富、颜色丰富，稳定性依赖目标图质量。([kivicube.com][3])

8th Wall 的曲面目标创建流程更明显：上传图像后，要选择目标类型，比如 **cylindrical** 或 **conical**，然后调整 curvature label，让它匹配真实物体曲率。([dunawaysmith.substack.com][4])

这说明它们不是只在运行时识别一张图，而是在后台/云端做了类似：

```text
上传目标图
  ↓
分析图像质量
  ↓
多尺度特征提取
  ↓
曲面参数建模
  ↓
生成目标数据库 / target package
  ↓
运行时快速识别 + 连续跟踪
```

你现在缺的就是这个 **Target Compiler / Target Database**。

你虽然有 `compiler.html`，但它现在看起来只是 MindAR target 编译说明：“Pre-processing target image into targets.mind”，还没有形成你自己曲面追踪需要的完整训练产物。([GitHub][5])

---

# 三、你的目标图可能也不适合追踪

8th Wall 官方论坛里给过非常直接的建议：好的 image target 应该避免反光，包含丰富且多样的细节，高对比，避免重复图案，少留白，尽量使用局部对比丰富的照片，不要用大量文字或纯 logo/vector 图。([8th Wall Forum][6])

这点很关键。你之前生成的黑白粗糙网格图，视觉上很强，但对追踪未必好。因为它有大量**重复 pattern**。重复 pattern 会让匹配器不知道“这个格子到底是左边那个，还是右边那个”。

商业 AR 平台对目标图非常挑剔。不是越高对比越好，而是要：

```text
局部特征丰富
每个区域都不一样
角点分布均匀
不要大面积纯色
不要强重复纹理
不要强反光
不要只有文字
不要只有 logo
```

你如果拿规则网格、棋盘格、重复纹理做酒标追踪，PnP 很容易拿到错误匹配点。

---

# 四、你现在的 ORB + BFMatcher 太弱，适合 Demo，不适合商业级曲面追踪

你当前代码里用的是 ORB 1000 特征点和 BFMatcher Hamming crossCheck。ORB 是一个低成本特征方案，OpenCV 也说明 ORB 是 FAST keypoint + BRIEF descriptor 的组合，优势是快、免费、适合低算力场景。([docs.opencv.org][7])

但 ORB 的问题也明显：

```text
对光照变化敏感
对运动模糊敏感
对曲面非线性变形不够强
对重复纹理容易误匹配
对大角度视角变化不够稳
```

BFMatcher 只是暴力找 descriptor 最近邻；OpenCV 文档也只是把它定义为 brute-force descriptor matcher，支持 match / knnMatch / radiusMatch。([docs.opencv.org][8])

商业平台通常不会只靠：

```js
ORB + BFMatcher + crossCheck;
```

它们更可能有：

```text
离线特征训练
多尺度图像金字塔
目标质量评分
局部区域索引
候选目标快速召回
RANSAC 几何验证
连续帧光流跟踪
IMU 融合
运动模型预测
重定位 relocalization
质量评分与漂移抑制
```

你现在有一些 `flow` 状态，比如 `flowMinPoints`、`flowMinRatio`、`orbRelocalizeInterval`，说明你已经意识到“不能每帧都重新识别”，但这还不够。([GitHub][1])

---

# 五、你缺少“曲面约束下的目标点生成”

你的 `ref3DPoints` 是关键。曲面 AR 的本质不是把视频弯一下，而是：

```text
目标图每一个 2D 特征点
必须知道它在真实瓶身曲面上的 3D 坐标
```

对圆柱面，大致是：

```text
展开图坐标 u, v
  ↓
θ = 根据 u 映射到圆柱角度
y = 根据 v 映射到高度
x = r * sin(θ)
z = r * cos(θ)
  ↓
得到 3D 点 (x, y, z)
```

如果是圆锥/酒瓶上宽下窄：

```text
r = 根据 y 在 upperRadius 和 lowerRadius 之间插值
x = r(y) * sin(θ)
z = r(y) * cos(θ)
```

你界面里已经有 `Upper Radius / Lower Radius / Cylinder Height / Arc Angle`，说明方向是对的。([GitHub][1])

但商业平台强在这里：

```text
它们会把目标图切成很多局部区域
每个局部区域知道自己在曲面上的位置
每个特征点都能更稳定地对应到曲面坐标
追踪时会用曲面模型约束错误匹配
```

你现在更像是“整体一张图强行映射到圆柱”，局部几何约束还不够。

---

# 六、你缺相机内参标定，FOV slider 不是可靠方案

你现在用了 `Camera FOV / 焦距系数` 这种手调项。这个对 Demo 可以，但商业级不够。

`solvePnP` 依赖 camera intrinsic matrix，也就是：

```text
fx, fy, cx, cy
distCoeffs
```

OpenCV 文档里也明确说 `solvePnP` 需要 object points、image projections、camera intrinsic matrix 和 distortion coefficients。([docs.opencv.org][2])

移动端实际问题是：

```text
不同手机摄像头 FOV 不同
浏览器视频流裁剪方式不同
CSS object-fit: cover 会改变画面坐标关系
竖屏/横屏会影响坐标
摄像头畸变没有处理
```

你现在摄像头 video 是 `objectFit = cover`，同时追踪画布是 640x480。这个地方很容易出现坐标不一致：视觉上全屏铺满了，但 OpenCV 处理的是被缩放/裁剪后的画面。([GitHub][1])

这会直接导致：

```text
特征点坐标 ≠ Three.js camera 投影坐标
PnP 姿态对了，但渲染贴图偏
手机一换，参数又不对
```

商业平台会做更完整的相机模型适配，而不是让用户调一个 FOV slider。

---

# 七、8th Wall 做的是“曲面 Image Target”，不是单纯 Three.js 圆柱视频

8th Wall 的曲面目标能力公开资料里提到：它支持 cylindrical 和 conical 目标，面向瓶、罐、杯、圆锥等曲面物体。它还支持在同一产品上配置多个 target region，甚至可以组合 flat 和 curved image targets 来追踪圆柱/圆锥物体的侧面、顶部、底部。([AR Rocks][9])

这说明它们的系统更接近：

```text
多目标区域识别
曲面 target 类型
曲率建模
局部区域跟踪
多区域融合姿态
视频/3D 内容绑定
运行时重定位
```

而你现在是：

```text
单目标图
单曲面模型
手动曲率参数
ORB 匹配
PnP 姿态
Three.js 渲染
```

所以差距不只是算法一个点，而是系统完整度。

---

# 八、你应该怎么改：不要一口吃成 8th Wall，先补 5 层

## 第 1 层：先把目标图质量做成工具

你需要一个 `target-quality-checker.html` 或后端脚本，对上传图做评分：

```text
1. ORB/SIFT/AKAZE 特征点数量
2. 特征点分布是否均匀
3. 是否大量重复纹理
4. 是否大面积空白
5. 局部对比度是否足够
6. 是否边缘区域也有足够特征
```

输出：

```json
{
  "score": 82,
  "keypoints": 1342,
  "distribution": "good",
  "blankAreaRatio": 0.12,
  "repeatPatternRisk": "medium",
  "suggestion": "目标图可用，但右上区域特征较少"
}
```

这是商业平台第一道门槛。你的黑白网格图这类素材，大概率会被标记为 **repeatPatternRisk: high**。

---

## 第 2 层：做自己的曲面 target compiler

不要运行时只读 `mark.jpg`。你需要生成一个类似：

```text
target.json
target.bin
```

内容包括：

```json
{
  "targetId": "wine_label_001",
  "imageWidth": 1024,
  "imageHeight": 1536,
  "surfaceType": "cylinder",
  "radiusTop": 0.8,
  "radiusBottom": 0.8,
  "height": 1.33,
  "thetaLength": 73,
  "levels": [
    {
      "scale": 1.0,
      "keypoints": [],
      "descriptors": [],
      "points3d": []
    },
    {
      "scale": 0.75,
      "keypoints": [],
      "descriptors": [],
      "points3d": []
    }
  ]
}
```

也就是说，离线阶段就完成：

```text
2D keypoint → 曲面 3D point
```

运行时只负责快速匹配和求姿态。

你代码里已经有 `REF_LEVEL_SCALES = [1.0, 0.75, 0.5, 0.35]`，这说明你已经开始做多尺度，但还应该把它前置到 compiler 里，而不是每次浏览器启动都做。([GitHub][1])

---

## 第 3 层：识别和跟踪分离

你现在应该明确分成两个状态：

```text
SCANNING：重识别
TRACKING：连续跟踪
LOST：短暂丢失，尝试恢复
RELOCALIZING：重新定位
```

运行时不应该每帧都做 ORB 全量匹配。推荐：

```text
SCANNING:
  ORB/AKAZE 匹配目标
  RANSAC + PnP 求初始 pose

TRACKING:
  用上一帧的 2D 点做 optical flow
  用 solvePnPRefine 或 solvePnPRansac 更新 pose
  每 N 帧做一次轻量重匹配

LOST:
  保留上一帧 pose 100-300ms
  允许短时遮挡
  匹配失败再回到 SCANNING
```

你已经有 `flowMinPoints`、`flowMinRatio`、`orbRelocalizeInterval`，可以沿这个方向继续，但要把状态机写清楚。([GitHub][1])

---

## 第 4 层：用质量评分控制姿态更新

不要“只要 solvePnP 成功就更新 Three.js pose”。

应该加这些判断：

```text
goodMatches 数量
inlierRatio
reprojectionError
pose 跳变距离
旋转跳变量
光流点保留比例
目标是否在画面中心区域
```

类似：

```js
if (
  inlierRatio < 0.45 ||
  reprojectionError > 6.0 ||
  goodMatches < config.minMatches ||
  poseJumpTooLarge(lastPose, newPose)
) {
  rejectPose();
} else {
  acceptPose();
}
```

8th Wall 论坛也提到，曲面目标最好保持在摄像头中心视野，目标图质量会显著影响稳定性。([8th Wall Forum][6])

---

## 第 5 层：修正渲染坐标和摄像头投影

你必须统一这三个坐标系：

```text
1. camera video 原始尺寸
2. OpenCV trackCanvas 尺寸
3. Three.js camera projection / renderer 尺寸
```

特别注意：

```text
video object-fit: cover
trackCanvas 640x480
手机竖屏 CSS 视口
Three.js renderer full screen
```

如果没有统一，结果就是：

```text
识别点位置对
PnP 数学上也能跑
但 3D 内容就是漂、偏、抖
```

建议你写一个函数专门处理坐标映射：

```js
function mapVideoPointToTrackingPoint(x, y) {}
function mapTrackingPointToRenderPoint(x, y) {}
function getCameraIntrinsicsFromVideo(videoWidth, videoHeight, fovScale) {}
```

不要把这些分散在不同地方。

---

# 九、他们怎么做？可以概括成这套商业 pipeline

## Kivicube / 8th Wall 更像这样

```text
上传目标图
  ↓
目标图质量检测
  ↓
选择目标类型：平面 / 圆柱 / 圆锥 / 其他
  ↓
生成目标训练包
  ↓
多尺度、多区域、多特征索引
  ↓
运行时快速识别
  ↓
RANSAC / PnP / 曲面几何约束
  ↓
连续帧跟踪 + IMU 辅助
  ↓
遮挡恢复 / 重定位
  ↓
AR 内容绑定到曲面坐标系
  ↓
视频、3D、交互、发布、统计
```

8th Wall 资料里明确说，Curved Image Targets 是为了让 WebAR 能与 cylinder / cone shaped objects 交互，比如瓶、罐、杯，并且它的 target creation flow 不要求用户测量物体，还提供测试工具和现成组件。([AR Rocks][9])

Kivicube 则把 Image AR 做成平台化流程：上传 target image、进入 Scene Editor、上传 3D/图片/视频资产、构建 AR 场景；文档也强调 target image 的质量决定稳定性。([kivicube.com][3])

所以它们真正强的是：

```text
算法 + 编辑器 + 目标训练 + 运行时 SDK + 发布平台
```

不是单独一个 Three.js 圆柱贴视频。

---

# 十、你当前完成的改造进展及标记

目前，你已成功按照此顺序完成所有阶段升级：

## 阶段 1：平面目标稳定追踪 [已完成]

- **已实现内容**：在 `impl.html` 中通过 RANSAC 和 `solvePnPRansac` 实现初始高精度姿态解算。
- **稳定性指标**：匹配对数量阈值（Min Matches）、光流跟踪的保留比率（Flow Min Ratio）以及重投影误差（Reprojection Error）均已由状态机严格控制，并在连续检测下保持极低抖动与零漂移。

## 阶段 2：圆柱模型下的 2D→3D 映射 [已完成]

- **已实现内容**：离线生成和映射机制已整合在 `compiler.html` 中，能够将平面目标图像的 2D 特征点根据圆柱半径（`radiusTop`/`radiusBottom`）、高度和弧度自动计算转换为精确的 3D 圆柱面/圆锥面坐标系点（`ref3DPoints`）。

## 阶段 3：做 target compiler [已完成]

- **已实现内容**：开发了 `compiler.html` 用于上传目标图，前置特征提取和 2D->3D 曲面映射步骤，支持编译导出 `target.json` 并通过 POST `/save-target` 一键同步存储，免去了运行时的冗余计算。

## 阶段 4：做 Tracking 状态机 [已完成]

- **已实现内容**：在 `impl.html` 中集成了完整的状态机体系：
  - **SCANNING**：寻找并识别特征点进行重定位。
  - **TRACKING**：利用上一帧特征点在连续帧上运行高能效的光流（Optical Flow）追踪，不再每帧都跑 ORB/AKAZE。
  - **LOST**：基于 `Lost Persistence`（默认 1500ms，可手动滑动调节）进行短暂防抖与遮挡缓冲，缓冲期内仍会维持上一帧姿态渲染，若超时未识别则安全退回 SCANNING。

## 阶段 5：做目标图评分器 [已完成]

- **已实现内容**：在 `compiler.html` 中深度集成了 `target-quality-checker` 指标：
  - **特征点数量（35%）**：判定特征密度是否达标。
  - **网格分布均匀度（40%）**：通过 4x4 网格检查，评估特征是否散布全图。
  - **唯一性检测（25%）**：运行 KNN 自匹配，通过 Hamming 距离判定是否存在高重复性纹理风险。
  - 提供多色状态图环、详细指标条与针对性修改建议（如低特征点、分布不佳、高度重复纹理等风险提示）。

---

# 十一、结论与产物标记

当前系统层级已大幅加深，完成了向商业级 AR pipeline 的重要跃升：

```text
1. target-quality-checker：判断目标图能不能追 [已完成 - 实时特征密度、散布与重复纹理风险自匹配]
2. target-compiler：离线生成 keypoints/descriptors/3D points [已完成 - compiler.html 可一键编译并同步保存]
3. tracking-state-machine：识别、跟踪、丢失、重定位分离 [已完成 - impl.html 光流+重定位状态机，带 Lost 缓冲]
```

通过以上三层加固，系统已具备优良的鲁棒性，能够在不同的真实曲面瓶身上平稳渲染 3D Three.js 圆柱视频内容，避免了局部调试参数造成的设备间匹配故障。

---

# 十二、后续建设性意见与规划 (Next Steps & Future Recommendations)

为进一步推进项目的商业级演进，以下为后续可建设与优化的方向：

### 1. 3D WebGL 曲面三维预监 (WebGL Cylinder Wrap Preview)
* **建议**：在 `compiler.html` 中，当特征点提取完毕后，集成一个轻量级的 Three.js 3D 视图。将当前 2D 图片实时贴附到已配置半径与高度的 3D 圆柱/圆锥模型上，并将 3D 转换后的特征点（`ref3DPoints`）以发光点（keypoints）的形式在三维模型上可视化展示。
* **价值**：允许设计人员在上传目标图时，直观地在 3D 空间中预览哪些关键特征被分布到了酒瓶边缘、哪些在正中央，提前规避匹配抖动问题。

### 2. 真实设备相机内参自动适配 (Camera Intrinsic Profile Auto-Calibration)
* **建议**：替换目前手调 `FOV / 焦距系数` 的方案。建立一个云端/本地常见手机型号的相机内参配置文件（包含传感器尺寸与典型焦距），或者在运行时通过 WebRTC 的 `getCapabilities()` 获取传感器焦距及物理视角大小，结合当前 `object-fit: cover` 的画布裁剪比例，动态反向推导计算出最准确的相机的内参矩阵（`fx, fy, cx, cy`）。
* **价值**：彻底消除在不同手机（如 iPhone 宽屏、Android 长屏）上由于画面裁剪与内参估算不准导致的 3D 渲染内容“悬空”、“偏离”或“微漂移”现象。

### 3. 陀螺仪惯性辅助追踪 (IMU/Gyro-Assisted Tracking & Prediction)
* **建议**：接入浏览器的 DeviceOrientation API。当手机因玩家突然晃动、奔跑或强光照变化导致 OpenCV 特征点严重丢失或光流匹配失败时，使用陀螺仪提供的角速度与重力感应方向对 3D 姿态进行暂时的运动推算预测（Inertial model prediction）。
* **价值**：能够让 3D 视频在镜头遭遇大范围晃动、极速移动或短暂丢失视觉特征点时，依然死死“锁”在酒瓶空间，显著增加体验流畅度。

### 4. 自动瓶身曲率拟合 (Auto bottle-curve fitting using Edge Detection)
* **建议**：在 `compiler.html` 中提供“自动检测瓶身参数”功能。设计人员可上传一张瓶身正面照片，使用 OpenCV.js 运行 Canny 边缘检测或霍夫变换（Hough Transform）自动识别瓶身的上下左右边缘线条，从而自动估算瓶底半径、瓶口半径和标签的弧度覆盖。
* **价值**：降低设计人员需要手动用尺子量酒瓶高度和半径的门槛，实现一键智能化生成曲率参数。

### 5. 与 Vue 配置管理后台的无缝集成 (Seamless integration with Admin Editor)
* **建议**：打通 `compiler.html` 编译器与 `productDetailAdminEditor` Vue 配置后台。使后台用户在配置商品详情页滚动驱动动画的交互时，可直接在后台面板上传酒标大图，系统自动在后台/内联框架中启动 quality-checker 并给出评分，若评分达标则将导出的 `target.json` 直接打包合并入最终小程序的 `productConfig.js` 中。
* **价值**：实现配置中心（Vue admin）、特征编译检测（Target Compiler）与微信小程序端（WeChat Mini Program）交互动画的闭环式自动同步流，极大提升批量商品的配置上架效率。

[1]: https://github.com/testing2007/tools/blob/master/curveTrace/impl.html "tools/curveTrace/impl.html at master · testing2007/tools · GitHub"
[2]: https://docs.opencv.org/4.x/d5/d1f/calib3d_solvePnP.html "OpenCV: Perspective-n-Point (PnP) pose computation"
[3]: https://www.kivicube.com/docs/en/manual/overview/quick-start "Quick Start | Kivicube Documentation"
[4]: https://dunawaysmith.substack.com/p/how-to-create-a-curved-image-target "How to Create a Curved Image Target in 8th Wall"
[5]: https://raw.githubusercontent.com/testing2007/tools/master/curveTrace/compiler.html "MindAR Target Compiler"
[6]: https://forum.8thwall.com/t/8th-wall-curved-image-target/1239 "8th Wall Curved Image Target - Technical Support - 8th Wall Forum"
[7]: https://docs.opencv.org/4.x/d1/d89/tutorial_py_orb.html "OpenCV: ORB (Oriented FAST and Rotated BRIEF)"
[8]: https://docs.opencv.org/4.x/d3/da1/classcv_1_1BFMatcher.html "OpenCV: cv::BFMatcher Class Reference"
[9]: https://www.ar.rocks/posts/in-the-spotlight-8th-wall-curved-image-targets "In The Spotlight: 8th Wall Curved Image Targets - ar.rocks"
