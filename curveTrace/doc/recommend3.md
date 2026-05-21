对，现在你进入了更难的一层：**不是“延迟能不能降一点”，而是“真实摄像头画面和虚拟 Three.js 内容是否使用同一个时间、同一个坐标、同一个相机模型”。**

你现在肉眼还能看到两个不同步，通常有三类原因：

```text
1. 时间不同步：虚拟内容用的是上一帧/更早的姿态
2. 空间不同步：PnP 坐标、Three.js 投影、DOM video 裁剪不完全一致
3. 显示链路不同步：摄像头 video 是 DOM 层，AR 内容是 WebGL 层，浏览器合成时可能天然差一拍
```

你现在最该做的不是继续微调 `lerpFactor`，而是把系统改成**同帧合成**。

---

# 一、最大问题：你现在是 DOM 摄像头层 + WebGL AR 层

你代码里 `setupCamera()` 是这样做的：

```js
video.style.position = 'absolute';
video.style.width = '100vw';
video.style.height = '100vh';
video.style.objectFit = 'cover';
video.style.zIndex = '0';
document.body.appendChild(video);
```

然后 Three.js renderer 在另一个 canvas 上覆盖。也就是说实际显示链路是：

```text
DOM video 摄像头画面
+
WebGL canvas 虚拟视频贴图
+
浏览器 compositor 最后合成
```

这会导致一个很难彻底消除的问题：**你处理的是某一帧 cameraVideo，但用户看到的 DOM video 可能已经是另一帧。**

MDN 对 `requestVideoFrameCallback()` 的说明里明确提到，它会在新视频帧发送到 compositor 时回调，并且浏览器视频合成和主线程回调之间仍可能差一个 vsync；它还提供 `expectedDisplayTime`、`presentationTime`、`presentedFrames` 等 metadata 用来判断是否晚了一帧。([MDN网页文档][1])

所以你现在如果想做到“完美融为一体”，第一步是：

> **不要再让 DOM video 直接显示摄像头画面。把摄像头画面也放进 Three.js / WebGL 里渲染。**

---

# 二、改造方向：单 WebGL 合成

目标变成：

```text
cameraVideo 只作为数据源，隐藏
↓
Three.js 用 cameraVideo 做背景纹理
↓
同一个 renderer 同一帧渲染：
  背景摄像头
  +
  虚拟曲面视频
```

这样浏览器只合成一个 WebGL canvas，而不是 DOM video + WebGL canvas 两层。

## 你现在的结构

```text
cameraVideo DOM 直接显示
Three.js canvas 叠在上面
processFrame 从 cameraVideo 读图
```

## 建议改成

```text
cameraVideo 隐藏
cameraVideoTexture = new THREE.VideoTexture(cameraVideo)
cameraBackgroundMesh / scene.background 显示摄像头
AR 视频贴图也在同一个 Three.js renderer 里
```

### 示例结构

```js
let cameraFeedTexture = null;
let cameraFeedScene = null;
let cameraFeedCamera = null;
let cameraFeedMesh = null;

function initCameraBackground() {
    cameraVideo.style.display = 'none';

    cameraFeedTexture = new THREE.VideoTexture(cameraVideo);
    cameraFeedTexture.minFilter = THREE.LinearFilter;
    cameraFeedTexture.magFilter = THREE.LinearFilter;
    cameraFeedTexture.generateMipmaps = false;

    cameraFeedScene = new THREE.Scene();
    cameraFeedCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
        map: cameraFeedTexture,
        depthTest: false,
        depthWrite: false
    });

    cameraFeedMesh = new THREE.Mesh(geometry, material);
    cameraFeedScene.add(cameraFeedMesh);
}
```

渲染时：

```js
renderer.autoClear = false;

renderer.setAnimationLoop(() => {
    renderer.clear();

    // 先渲染摄像头背景
    renderer.render(cameraFeedScene, cameraFeedCamera);

    // 再渲染 AR 内容
    renderer.clearDepth();
    renderer.render(scene, camera);
});
```

这一步是质变。它解决的是**两层画面不是同一个显示通道**的问题。

---

# 三、第二个问题：你的 `object-fit: cover` 坐标可能还没完全统一

你现在 DOM video 使用：

```js
video.style.objectFit = 'cover';
```

同时 OpenCV 追踪用：

```js
trackW = 640;
trackH = 480;
trackCtx.drawImage(cameraVideo, 0, 0, trackW, trackH);
```

这两个显示坐标不一定完全一致。

你的 `updateCameraProjection()` 已经在计算 `object-fit: cover` 的缩放和偏移，这是对的；但只要 DOM video 和 WebGL canvas 不是同一个渲染通道，仍然会存在边界误差。你代码里确实有 `updateCameraProjection()` 试图把 tracking 坐标投到 full-screen video 显示坐标上，这是正确方向，但它不能解决“DOM video 和 WebGL canvas 两条显示链路不同步”的问题。

改成单 WebGL 背景后，你还要做一件事：**摄像头背景 plane 的 UV 裁剪必须和 `updateCameraProjection()` 里的 cover 逻辑一致。**

否则你会看到：

```text
中心大体对
边缘不贴
左右偏一点
上下移动时漂
```

---

# 四、第三个问题：你需要“同帧姿态”，不是“最新姿态”

现在你的流程大概是：

```text
rVFC / animationLoop 读取 cameraVideo
↓
OpenCV 计算姿态
↓
Three.js 渲染
↓
DOM video 自己显示当前摄像头画面
```

更正确的是：

```text
拿到视频帧 metadata
↓
用这帧做 OpenCV
↓
保存 pose.mediaTime / pose.expectedDisplayTime
↓
渲染时只使用与当前视频帧最接近的 pose
```

MDN 的 `requestVideoFrameCallback()` metadata 里有 `mediaTime`、`presentationTime`、`expectedDisplayTime`、`presentedFrames`，这正是给视频帧同步用的。([MDN网页文档][1])

### 建议你先加这个诊断

```js
let lastVideoFrameMeta = null;
let lastPoseMeta = null;

function startVideoProcessingLoop() {
    const onFrame = (now, metadata) => {
        lastVideoFrameMeta = metadata;

        const lateBy = now - metadata.expectedDisplayTime;
        const timeToDisplay = metadata.expectedDisplayTime - now;

        // 记录这个 pose 是基于哪一帧算出来的
        processFrame(metadata);

        cameraVideo.requestVideoFrameCallback(onFrame);
    };

    cameraVideo.requestVideoFrameCallback(onFrame);
}
```

在 `processFrame(metadata)` 成功求姿态后：

```js
lastPoseMeta = {
    mediaTime: metadata.mediaTime,
    expectedDisplayTime: metadata.expectedDisplayTime,
    presentationTime: metadata.presentationTime,
    solvedAt: performance.now()
};
```

调试面板显示：

```text
Video mediaTime
Pose mediaTime
Pose age
Expected display delta
Presented frames
```

如果你发现：

```text
pose age > 30ms
或者 expectedDisplayTime - now 接近 0 / 负数
```

说明你渲染的是晚到的姿态，肉眼就会看到不同步。

---

# 五、第四个问题：你不能只追踪“位置”，还要做短时预测

即使用同一个 WebGL canvas，同一帧处理，只要计算耗时 20~40ms，虚拟内容还是会落后真实画面。

商业 AR 通常会做一点 pose prediction。你现在还没有这一层。

你可以先做一个很简单的线性预测：

```js
let lastPoseSample = null;
let poseVelocity = new THREE.Vector3();
let predictedPos = new THREE.Vector3();

function updatePoseVelocity(newPos, now) {
    if (lastPoseSample) {
        const dt = Math.max((now - lastPoseSample.time) / 1000, 0.001);
        poseVelocity.copy(newPos).sub(lastPoseSample.pos).multiplyScalar(1 / dt);
    }

    lastPoseSample = {
        pos: newPos.clone(),
        time: now
    };
}

function getPredictedPosition(basePos, predictMs = 25) {
    return predictedPos.copy(basePos).addScaledVector(poseVelocity, predictMs / 1000);
}
```

应用时：

```js
const now = performance.now();
updatePoseVelocity(targetPos, now);

const predicted = getPredictedPosition(targetPos, 20);
currentPos.copy(predicted);
currentQuat.copy(targetQuat);
```

先只预测 position，不要一开始预测 quaternion。预测太多会抖，建议从：

```text
predictMs = 12 ~ 25ms
```

开始。

---

# 六、第五个问题：PnP 空间误差会被肉眼看成“不同步”

你说“两个不能完美融为一体”，不一定全是时间延迟，也可能是**空间贴合误差**。

OpenCV 的 PnP 本质是通过 3D 点和 2D 图像点对应关系估计相机姿态；OpenCV 文档里 `solvePnP` / `solvePnPRansac` 都属于 camera calibration / 3D reconstruction 模块，输入依赖 object points、image points、camera matrix、distortion coefficients。([OpenCV 文档][2])

你现在最容易出错的是：

```text
1. cameraMatrix 只是 fovScale 估计，不是真实手机内参
2. distCoeffs = 0，没有摄像头畸变
3. 目标图是曲面，但 Homography 先验是平面
4. 酒瓶真实曲率和你的 radiusTop/radiusBottom/thetaLength 不完全一致
5. mark.jpg 展开图和真实瓶身打印/拍摄比例不一致
```

这些都会造成：

```text
画面静止时也不是完全贴住
移动时边缘漂
旋转时贴图像滑动
中心对，边缘不对
```

如果是这种情况，继续降延迟没用。你要先判断到底是“时间错位”还是“空间错位”。

---

# 七、做一个最关键的诊断：重投影点可视化

你现在已经计算了 reprojection error，但只显示数字不够。你要在 AR 画面上画两组点：

```text
绿色点：OpenCV 实际检测到的 2D 特征点
红色点：用当前 rvec/tvec 把对应 3D 点 projectPoints 回来的点
```

如果：

```text
红绿点重合，但视频贴图不重合
=> Three.js 投影 / 背景裁剪 / 显示链路问题

红绿点本身就不重合
=> PnP / 3D 曲面点 / 相机内参 / 匹配点问题
```

这是下一步必须做的诊断工具。

OpenCV 的重投影误差就是用投影点和测量点之间的图像距离衡量几何估计误差；这个指标可以直接用来判断你的 pose 是否真的贴合。([维基百科][3])

### 你可以增加一个 overlay canvas

```js
let debugOverlayCanvas;
let debugOverlayCtx;

function initDebugOverlay() {
    debugOverlayCanvas = document.createElement('canvas');
    debugOverlayCanvas.width = window.innerWidth;
    debugOverlayCanvas.height = window.innerHeight;
    debugOverlayCanvas.style.position = 'absolute';
    debugOverlayCanvas.style.left = '0';
    debugOverlayCanvas.style.top = '0';
    debugOverlayCanvas.style.zIndex = '20';
    debugOverlayCanvas.style.pointerEvents = 'none';
    document.body.appendChild(debugOverlayCanvas);
    debugOverlayCtx = debugOverlayCanvas.getContext('2d');
}
```

画点时要注意：**OpenCV tracking 坐标必须映射到屏幕坐标**，不能直接用 640x480 点位。

---

# 八、你下一步最应该做的 4 个任务

## 任务 1：把摄像头画面并入 Three.js 渲染

这是第一优先级。

```text
隐藏 DOM cameraVideo
Three.VideoTexture(cameraVideo) 做背景
同一个 renderer 渲染 camera background + AR mesh
```

这一步解决“两层画面显示链路不同步”。

---

## 任务 2：加 rVFC metadata 调试

显示这些字段：

```text
mediaTime
presentationTime
expectedDisplayTime
presentedFrames
poseAgeMs
frameLateMs
```

判断你是不是总是晚一帧。MDN 明确说明可以通过比较 `now` 和 `expectedDisplayTime` 判断回调是否已经晚于 vsync。([MDN网页文档][1])

---

## 任务 3：做红绿重投影点可视化

这是判断“空间错位”还是“时间错位”的关键。

```text
红绿点重合，贴图不重合：WebGL 投影/背景裁剪问题
红绿点不重合：PnP/相机内参/曲面模型问题
```

---

## 任务 4：加 12~25ms 轻量预测

不要一开始搞复杂 Kalman。先做 position 线性预测。

```text
光流稳定时：预测 16~25ms
重定位刚成功：不预测，先锁定
LOST/PERSISTENCE：不预测
```

---

# 九、如果你想更接近“完美融为一体”，最终要走这个结构

```text
cameraVideo hidden
  ↓
requestVideoFrameCallback 获取真实视频帧时间
  ↓
OpenCV 从同一帧计算 pose
  ↓
pose 带 mediaTime / expectedDisplayTime
  ↓
短时预测补偿 16~25ms
  ↓
Three.js 单 renderer：
    pass 1: camera background
    pass 2: AR curved video mesh
  ↓
重投影点可视化校验空间误差
```

你现在之前优化的是：

```text
让 OpenCV 算得更快
```

但现在要优化的是：

```text
让真实摄像头画面和虚拟内容使用同一帧、同一投影、同一显示链路
```

这才是“融为一体”的核心。

---

# 直接结论

你现在别继续只调 `flowMinPoints / lerpFactor / PnP`。下一步应该这样排：

```text
1. 摄像头背景从 DOM video 改为 Three.js VideoTexture 背景
2. 用 requestVideoFrameCallback metadata 做 pose/frame 同步诊断
3. 做红绿重投影点可视化，判断是不是空间误差
4. 加 16~25ms pose prediction
5. 如果红绿点长期偏，才继续修 cameraMatrix / distortion / 曲面 3D 映射
```

如果第 1 步不做，你会一直在“DOM video 已经更新了，但 WebGL AR 还用上一帧 pose”的坑里打转。现在要从“算法优化”切到“渲染同步架构优化”。

[1]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback "HTMLVideoElement: requestVideoFrameCallback() method - Web APIs | MDN"
[2]: https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html "OpenCV: Camera Calibration and 3D Reconstruction"
[3]: https://en.wikipedia.org/wiki/Reprojection_error?utm_source=chatgpt.com "Reprojection error"
