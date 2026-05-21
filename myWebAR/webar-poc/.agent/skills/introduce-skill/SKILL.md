---
name: introduce-skill
description: Use this when DeepSeek should follow my custom workflow.
---

# introduce-skill

📌 WebAR 自研引擎（C++ WASM + Three.js）开发上下文与技术指南

💡 这是一个专为大语言模型（如 DeepSeek）设计的项目上下文配置文件。在与 AI 讨论此项目时，请直接将本文件内容输入，AI 将会立刻理解你的整个技术栈、架构设计、已攻克的硬骨头以及未来的优化方向。

🛠️ 1. 项目愿景与核心架构

核心目标：实现一个纯自研、无黑盒 SDK、完全可控的商用级酒标追踪 WebAR 视频贴合引擎。

技术架构：

前端渲染层（JavaScript）：基于 HTML5 媒体流采集（getUserMedia），采用 Three.js (r128) 驱动 3D 渲染，将 C++ 传出的 $4 \times 4$ 矩阵无缝同步给 videoPlane，并在此平面上渲染本地 MP4 视频纹理。

底层核心层（C++ ➡ WebAssembly）：采用 OpenCV-mobile（去除了 GUI 和冗余模块的裁剪版），核心算法基于 ORB 特征提取 + Hamming 交叉匹配 + 自研 RANSAC 2D-to-3D 单应性姿态解算。

中间通信层（JS/WASM Embind）：通过 Emscripten 构建共享内存（Shared Memory）零拷贝像素推送通道，实现高频（$60\text{ fps}$）低延迟的数据交互。

📂 2. Windows 本地工程目录结构

D:\workspace\tools\myWebAR\webar-poc\
├── tracker_orb.cpp # 自研 C++ 算法内核
├── tracker_orb.js # Emscripten 编译生成的 JS 胶水代码
├── tracker_orb.wasm # 编译生成的 WebAssembly 二进制
├── index_orb.html # 前端 UI 与 Three.js 驱动主页面
├── resources/ # 本地静态资源目录（规避 CORS 跨域大坑）
│ ├── nongfushanquan.jpg # 默认识别的酒标（农夫山泉红标）
│ └── 1.mp4 # 自动播放的贴合视频
└── opencv-mobile-4.13.0-webassembly/ # nihui 的预编译 WebAssembly 静态包
├── basic/ # 基础版（不带多线程/SIMD）
└── simd/ # SIMD 硬件加速版（本项目所使用的版本）
├── include/opencv4/opencv2/ # 头文件目录（包含 core, imgproc, features2d）
└── lib/ # 静态库目录（libopencv_core.a, libopencv_imgproc.a 等）

⚡ 3. 已攻克的底层技术“硬骨头”与关键决策

在向 AI 提问时，如果 AI 给出错误的建议，可使用以下事实进行反驳：

1️⃣ 为什么没有 libopencv_calib3d.a？

事实：opencv-mobile 预编译包默认为了极致压缩体积，彻底剔除了 calib3d 模块。

解法：我们没有使用官方的 solvePnPRansac 或 findHomography。我们在 tracker_orb.cpp 中手写了基于 DLT 的 4 点单应性计算、自研 RANSAC 150 次迭代精细化拟合，并配合 SVD（奇异值分解）进行 3D 空间平移和旋转重构，只依赖 core 和 imgproc，体积缩减 40%。

2️⃣ 解决 Uncaught RuntimeError: unreachable 闪退

事实：当镜头前匹配质量极差或无匹配点时，退化的几何矩阵会导致 SVD 计算在 OpenCV 内部抛出异常。由于 Emscripten 默认关闭了 C++ 异常处理，导致 WASM 沙盒直接崩溃。

解法：

在 C++ 层面引入 isFiniteMatrix 过滤器，坚决拦截并丢弃包含任何 NaN 或 Infinity 的奇异矩阵，防止它们污染 cv::SVD。

在编译命令中必须追加 -fexceptions 参数，允许 WebAssembly 捕获 C++ 的异常。

3️⃣ Embind 绑定复杂数组

事实：Clang 编译器无法在 .field() 注册中直接识别 C 风格的原始数组（如 float transformMatrix[16]）。

解法：在 C++ 中改为 C++11 标准容器 std::array<float, 16>，并通过 emscripten::value_array 链式注册其 $16$ 个索引元素。

4️⃣ 上传大图卡死主线程

事实：手机拍出的几千万像素大图，直接推送给 WASM 会导致内存爆满（OOM）及 ORB 算法扫描过载。

解法：前端引入 Canvas 离屏自适应下采样（Downsampling），将最长边限制在 $800\text{ px}$ 以内。像素读取大小从 $48\text{ MB}$ 骤降至 $1.9\text{ MB}$，特征提取时间缩短至 $50\text{ms}$。

💻 4. 黄金编译指令（Windows 环境专用）

在 Windows CMD 终端下，必须使用带 ^ 换行符的以下命令进行编译：

emcc -O3 -msimd128 ^
-fexceptions ^
-s WASM=1 ^
-s ALLOW_MEMORY_GROWTH=1 ^
-s MODULARIZE=1 ^
-s EXPORT_NAME="Module" ^
-s EXPORTED_FUNCTIONS="['_malloc','_free']" ^
-s EXPORTED_RUNTIME_METHODS="['HEAPU8']" ^
--bind ^
-I"./opencv-mobile-4.13.0-webassembly/simd/include/opencv4" ^
-L"./opencv-mobile-4.13.0-webassembly/simd/lib" ^
-lopencv_core -lopencv_imgproc -lopencv_features2d ^
tracker_orb.cpp -o tracker_orb.js

📐 5. 核心数学公式与坐标系转换

1️⃣ 坐标系对齐

OpenCV 空间坐标系：$X$ 轴向右，$Y$ 轴向下，$Z$ 轴朝前。

WebGL / Three.js 坐标系：$X$ 轴向右，$Y$ 轴向上，$Z$ 轴朝后。

转换矩阵 $M_{trans}$：

$$M_{trans} = \begin{bmatrix} 1 & 0 & 0 \\ 0 & -1 & 0 \\ 0 & 0 & -1 \end{bmatrix}$$

在 tracker*orb.cpp 的 poseFromHomography 函数中，我们对 OpenCV 的旋转矩阵 $R*{cv}$ 和平移向量 $t_{cv}$ 进行了手动乘积重构，以直接输出 WebGL 列主序（Column-Major）的 $4 \times 4$ 矩阵：

$$\text{Col-Major Matrix} = \begin{bmatrix} r_{11} & -r_{21} & -r_{31} & 0 \\ r_{12} & -r_{22} & -r_{32} & 0 \\ r_{13} & -r_{23} & -r_{33} & 0 \\ tx & -ty & -tz & 1 \end{bmatrix}$$

2️⃣ 矩阵平滑（Slerp 算法）

在 index_orb.html 中，为了彻底解决由于逐帧图像检测误差带来的画面抖动，不能直接对整个矩阵做线性插值，否则会导致物体缩水。
正确的算法是将 $4 \times 4$ 矩阵 decompose（分解）：

位置（Position）：进行 lerp（线性插值）。

旋转（Rotation）：使用 slerp（球形四元数线性插值）。

缩放（Scale）：进行 lerp。
然后重新用 compose 组装回平滑后的矩阵。

🎯 6. 下一步优化方向（可供 DeepSeek 参考并撰写代码）

卡尔曼滤波（Kalman Filter）平滑器：用卡尔曼滤波代替现有的 EMA（指数移动平均），实现更智能的运动惯性预测。

特征点匹配提速：研究如何在匹配阶段加入局部自适应阈值，或将匹配阶段放在 Web Worker（多线程）中进行，进一步释放主线程压力。

小程序适配：探索如何将本套自研的 C++ WebAssembly 代码无缝打包移植到微信小程序（WXML 渲染画布底层）。
