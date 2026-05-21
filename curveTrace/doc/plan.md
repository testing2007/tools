# WebAR 弧面追踪与校准项目实施记录及优化规划 (Curved Label Tracking Plan & Record)

本项目致力于解决 WebAR 中，将平面视频/图片贴合在真实物理圆柱弧面（如饮料瓶、酒瓶）上时所面临的**追踪延迟（抖动漂移）**、**视差滑动（贴合度低）**以及**对齐偏差**等行业痛点。通过自研的 OpenCV.js 弧面追踪引擎，彻底抛弃了原先只能用于纯平海报的 MindAR，实现了低延迟、高贴合度的 AR 沉浸式效果。

---

## 1. 已完成的工作 (Completed Work)

我们对 [impl.html](file:///d:/workspace/tools/curveTrace/impl.html) 进行了全方位的重构与优化，具体工作如下：

### A. 弃用 MindAR，自研 OpenCV.js 追踪引擎
* **ORB 特征匹配**：引入 OpenCV.js，在后台以 $320 \times 240$ 分辨率的轻量化画布实时捕获相机帧，利用 ORB（Oriented FAST and Rotated BRIEF）算法快速提取特征点并进行 Hamming 汉明距离双向匹配。
* **PnP 位姿解算**：基于 2D 特征点与 3D 圆柱投影点云的映射关系，使用 `cv.solvePnPRansac`（及 `cv.solvePnP` 容错备用）在每一帧求解相机的三维位姿（`rvec` 旋转向量与 `tvec` 平移向量）。
* **相机位姿映射**：使用 Rodrigues 变换将 OpenCV 相机坐标系（$Y$-down, $+Z$-forward）完美映射至 Three.js 坐标系（$Y$-up, $-Z$-forward），直接通过 inverse modelView 矩阵反向驱动虚拟相机的平移与旋转。

### B. 弧面几何重建与纹理映射 (Cylindrical Mapping & UV Setup)
* **圆柱点云投影**：实现了根据瓶身尺寸（上下半径 $R_{top}/R_{bottom}$、高度 $H$、弧度张角 $\theta$）动态将 2D 像素坐标映射为 3D 圆柱曲面坐标的算法：
  $$X_i = R_y \cdot \sin(\theta_i)$$
  $$Y_i = (H/2 - v_i) \cdot scale$$
  $$Z_i = R_y \cdot \cos(\theta_i)$$
* **自适应截台 (Frustum) 支持**：支持上下半径不一致的瓶身（渐变斜度瓶身），在计算点云高度 $Y$ 时，线性插值计算当前高度下的圆柱半径，保证完美贴合。
* **正对视角（+Z轴对齐）与防镜像**：将虚拟圆柱网格的起始张角 `thetaStartVal` 修改为以 $90^\circ$（即 $+Z$ 正前方）为中心对称展开。配合 Three.js 纹理的水平镜像翻转（`repeat.x = -1`, `offset.x = 1`），消除了 $90^\circ$ 画面旋转偏差及镜像反转问题，使视频画面在默认参数下即刻完美对齐酒标。

### C. 内存泄露消除与性能调优
* **WASM 内存回收**：消除了在 `processFrame` 运行循环中频繁分配 `cv.Mat` 造成的 WebAssembly 堆内存泄露。实现了全局预分配 `maskMat` 并复用。
* **3D 坐标预计算缓存 (Coordinate Caching)**：实现了 `ref3DPoints` 坐标缓存机制。点云坐标仅在加载图样或拖动标定滑块时重新计算，避免了高频每帧三角函数计算。

### D. 双模调试与实时标定
* **Live AR 模式与 3D Preview 模式**：支持一键切换。在 3D 预览模式下，利用 OrbitControls 可自由旋转观测虚拟圆柱瓶身，以及底层的半透明 `mark.jpg` 酒标贴图材质指引，便于脱机微调参数。
* **实时 matches 数量反馈**：在状态徽章实时显示当前帧匹配成功的特征点数量（如 `DETECTED (35 matches)`），便于用户研判跟踪质量。

### E. 异常值过滤与几何校验 (Outlier Rejection & Pose Validation) [NEW]
* **单应性 RANSAC 预过滤**：在 PnP 解算前，利用 `cv.findHomography` 对特征点执行 RANSAC 过滤（重投影阈值 8.0 像素），筛除不符合平面刚性几何规律的背景噪声（键盘、桌面、屏幕杂斑），提取最纯净的 inlier 特征子集。
* **内含比率校验 (Inlier Ratio Check)**：引入 `InlierRatio >= 20%` 校验条件，有效防止背景杂乱产生的误触发。
* **几何位姿双重校验**：对 PnP 输出的平移向量执行有限数值判定及 $Z$-depth 判定（`tD[2] > 0.1` 必须在相机前方）。通过分解反向相机世界矩阵，计算相机离瓶身坐标中心的实际距离，滤除超出 $[0.5, 25.0]$ 范围的异常跳变，彻底消除视频贴图“满天飞”或提前错误触发的现象。

### F. 目标图特征可视化 (Target Keypoints Visualizer) [NEW]
* **关键点渲染**：在标定面板底部增加了“目标特征点可视化”调试 Canvas，直接绘制出 `assets/mark.jpg` 提取的所有 ORB 特征点及其尺度范围，帮助开发者判断样本图像纹理质量。
* **溢出滚动布局**：针对大尺寸样本图像，设置了滚动容器（`overflow: auto; max-height: 200px`），防止图像溢出标定面板。

---

## 2. 核心算法思想 (Core Algorithmic Principles)

### A. 相机内参及投影自适应裁剪补偿 (Aspect Ratio & Fit Cover Compensation)
为了防止相机流被 CSS `object-fit: cover` 裁剪拉伸后与 Three.js 三维物体产生视差偏差，我们通过计算屏幕分辨率与相机原生分辨率的缩放比，重构了 Three.js 摄像机的投影矩阵：
$$Scale = \max(W_{screen}/W_{video}, H_{screen}/H_{video})$$
$$f'_{x} = f_x \cdot Scale_{nativeX} \cdot Scale$$
通过这种方式，将 $320 \times 240$ 追踪画布下的内参投影无缝缩放到全屏视口，保证了虚拟模型在屏幕上的成像位置与真实瓶子完全重合。

### B. 响应度控制与平滑插值
引入用户可调参数 `lerpFactor`。若 `lerpFactor >= 0.99`，则绕过所有平滑滤波器实现零延迟强行锁死；若在 `0.02 ~ 0.98` 之间，则对解算出的相机位置进行 Lerp（线性插值）及 Quaternion Slerp（球面四元数插值），保证画面平滑不抖动。

---

## 3. 后续需要改进的地方与优化方向 (Future Improvements & Issues)

### 1) 实际测试痛点分析 (Current Testing Issues)

> [!WARNING]
> **痛点一：识别距离过短（必须贴近摄像头约 5cm 才能触发识别）**
> * **根本原因**：
>   1. **画布分辨率过低**：目前实时跟踪帧 canvas 设为 $320 \times 240$。当物理瓶身距离镜头超过 5cm 时，酒标图像在画面中占比变小（例如缩小为 $60 \times 120$ 像素），降采样导致细节严重丢失，ORB 特征匹配点数量直接跌破阈值，致使 RANSAC/PnP 校验无法通过。
>   2. **固定的汉明截止阀值与特征点数**：目标酒标分辨率高（$304 \times 666$），而相机流在降采样后清晰度无法对应，两端特征空间不匹配。
> * **解决方案**：
>   1. **升级跟踪分辨率**：将 `trackW` / `trackH` 提升至 $640 \times 480$（目前移动端设备已能够轻松承载该分辨率的 ORB 检测，帧率可保持在 30 FPS 上下），保留更多远距离细节。
>   2. **目标图像金字塔下采样建图**：在提取 `assets/mark.jpg` 特征时，同时建立多尺度金字塔，确保相机在远距离拉伸、缩小情况下能匹配到对应的低分辨率描述子。
>   3. **自适应匹配截断**：根据相机实时画面中的特征点密集度，动态调整 `minMatches`。

> [!WARNING]
> **痛点二：贴合度不够（存在视差抖动或贴合不紧密）**
> * **根本原因**：
>   1. **虚拟焦距/内参不准确**：当前 `initCameraMatrix()` 中的焦距采用经验估算值（$fx = fy = trackW \cdot 1.05$）。如果手机摄像头的真实视场角（FOV）与此经验估算值偏差较大，PnP 求解出的深度（$Z$ 轴距离）和俯仰角就会有系统性误差，导致视频贴片随视角移动而产生偏移（Parallax Sliding）。
>   2. **畸变系数设为零**：没有对手机镜头普遍存在的径向畸变（Lens Distortion）进行纠正。
> * **解决方案**：
>   1. **新增“焦距系数/Camera FOV”调节滑块**：在校准面板中新增相机焦距乘数（如 `fovScale`）的滑动条，允许用户在 Live AR 或 3D Preview 下手动调校焦距估算，找到最稳健的贴合视角。
>   2. **畸变矫正矩阵**：添加简单的畸变标定配置，或在 PnP 计算时带入估算的畸变系数（如 `k1, k2`），纠正广角镜头的边缘弯曲。
>   3. **帧间滤波滤波优化**：除了位置插值，对 `solvePnP` 输出的旋转矩阵引入滤波平滑，防止由于个别误匹配点造成的局部微小偏差带来的画面起伏。

### 2) 基于光流法 (Optical Flow) 的帧间运动估计
* **算法改进**：在 PnP 解算成功后，下一帧使用 OpenCV.js 的金字塔 Lucas-Kanade 光流算法（`cv.calcOpticalFlowPyrLK`）对已跟踪的特征点进行跟踪，只在光流丢失时重新运行 ORB 全局检测。这能大幅提升跟踪帧率与抗运动模糊能力。