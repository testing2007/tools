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

# 十、你下一步最现实的改造顺序

不要直接追 8th Wall。你现在最应该做的是这个顺序：

## 阶段 1：先做“平面目标稳定追踪”

先不要管曲面。目标：

```text
平面 mark.jpg 能在手机上稳定识别
旋转、靠近、远离不明显抖
短暂遮挡不马上丢
```

完成标准：

```text
goodMatches > 50
inlierRatio > 0.5
reprojectionError < 5px
连续 10 秒不明显漂移
```

## 阶段 2：再做“圆柱模型下的 2D→3D 映射”

把每个特征点从展开图映射到圆柱面：

```js
function imagePointToCylinderPoint(u, v, imageW, imageH, config) {
  const nx = u / imageW - 0.5;
  const ny = 0.5 - v / imageH;

  const theta = nx * THREE.MathUtils.degToRad(config.thetaLength);
  const y = ny * config.height;

  const t = v / imageH;
  const r = config.radiusTop * (1 - t) + config.radiusBottom * t;

  return new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta));
}
```

## 阶段 3：做 target compiler

浏览器启动时不要重新提目标图特征。改成：

```text
compiler.html 上传目标图
  ↓
生成 target.json
  ↓
impl.html 加载 target.json
```

## 阶段 4：做 Tracking 状态机

```text
SCANNING → TRACKING → LOST → RELOCALIZING
```

这一层比你继续调 radius / FOV 更重要。

## 阶段 5：做目标图评分器

这一步会大幅减少你后续调试痛苦。很多“不稳定”不是算法问题，而是目标图根本不适合追踪。

---

# 十一、最直接的结论

你现在的问题可以压缩成一句话：

> 你把“曲面 WebAR”做成了“运行时 ORB 匹配 + solvePnP + Three.js 圆柱贴图”，但 Kivicube / 8th Wall 做的是“离线目标训练 + 曲面目标模型 + 鲁棒识别 + 连续跟踪 + 重定位 + 发布平台”。

你没有错在想法，错在**系统层次太薄**。

你下一步不要继续盲目调 UI 面板参数。先做这三个东西：

```text
1. target-quality-checker：判断目标图能不能追
2. target-compiler：离线生成 keypoints/descriptors/3D points
3. tracking-state-machine：识别、跟踪、丢失、重定位分离
```

做完这三层，你才有资格继续谈“曲面贴合效果像 8th Wall”。否则现在继续调 `radiusTop / thetaLength / fovScale`，大概率只是局部变好，换个手机、换个光线、换个角度又崩。

[1]: https://github.com/testing2007/tools/blob/master/curveTrace/impl.html "tools/curveTrace/impl.html at master · testing2007/tools · GitHub"
[2]: https://docs.opencv.org/4.x/d5/d1f/calib3d_solvePnP.html "OpenCV: Perspective-n-Point (PnP) pose computation"
[3]: https://www.kivicube.com/docs/en/manual/overview/quick-start "Quick Start | Kivicube Documentation"
[4]: https://dunawaysmith.substack.com/p/how-to-create-a-curved-image-target "How to Create a Curved Image Target in 8th Wall"
[5]: https://raw.githubusercontent.com/testing2007/tools/master/curveTrace/compiler.html "MindAR Target Compiler"
[6]: https://forum.8thwall.com/t/8th-wall-curved-image-target/1239 "8th Wall Curved Image Target - Technical Support - 8th Wall Forum"
[7]: https://docs.opencv.org/4.x/d1/d89/tutorial_py_orb.html "OpenCV: ORB (Oriented FAST and Rotated BRIEF)"
[8]: https://docs.opencv.org/4.x/d3/da1/classcv_1_1BFMatcher.html "OpenCV: cv::BFMatcher Class Reference"
[9]: https://www.ar.rocks/posts/in-the-spotlight-8th-wall-curved-image-targets "In The Spotlight: 8th Wall Curved Image Targets - ar.rocks"
