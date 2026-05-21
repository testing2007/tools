你这次代码已经明显进了一步：已经有 `target.json` 预编译目标包、LK 光流、`TRACKING_FLOW / RELOCALIZING / LOST / SCANNING` 状态机、漂移校正、RANSAC PnP、重投影误差过滤。也就是说，你已经从“每帧 ORB 扫描”走到“识别一次 + 光流追踪”的方向了。`recommend.md` 里 Gemini 的大方向没错，但它还停留在架构建议，没抓住你现在**延迟消不掉**的几个具体原因。

我直接下判断：**你现在的延迟主要不是识别算法不够先进，而是“姿态平滑 + 主线程同步计算 + 每帧 RANSAC + 每帧 DOM/Canvas 转换”叠加造成的。**

---

## 1. 第一处硬伤：`lerpFactor = 0.04` 本身就在制造肉眼延迟

你默认配置里：

```js
lerpFactor: 0.04
```

然后每次追踪成功后：

```js
currentPos.lerp(targetPos, factor);
currentQuat.slerp(targetQuat, factor);
```

这意味着每帧只向新姿态移动 4%。这不是“低延迟”，这是强平滑。你代码注释说 “Fast mode uses this as micro-smoothing only”，但 0.04 绝不是 micro-smoothing。

粗略算一下：

```text
60 FPS 下，lerpFactor = 0.04
半衰期约 17 帧 ≈ 283ms

30 FPS 下，半衰期约 17 帧 ≈ 566ms
```

所以你看到的“贴图跟手慢半拍”，很可能一大半就是这个参数造成的。

### 先改这个

```js
const defaultConfig = {
  // ...
  lerpFactor: 0.45
}
```

或者更直接，光流追踪成功时不要平滑：

```js
if (flowState === 'TRACKING_FLOW') {
    currentPos.copy(targetPos);
    currentQuat.copy(targetQuat);
} else {
    currentPos.lerp(targetPos, 0.35);
    currentQuat.slerp(targetQuat, 0.35);
}
```

更合理的策略是：

```text
SCANNING / RELOCALIZING：可以平滑，避免跳变
TRACKING_FLOW：少平滑或不平滑
LOST Persistence：冻结上一帧，不继续插值
```

这是你现在最应该先做的。不要先上 Worker，不要先换算法。先确认延迟到底是不是平滑造成的。

---

## 2. 第二处硬伤：你每一帧光流成功后，仍然跑 `solvePnPRansac`

你现在 `tryTrackWithOpticalFlow()` 里：

```js
cv.calcOpticalFlowPyrLK(...)
solvePoseFromArrays(...)
```

而 `solvePoseFromArrays()` 里面优先调用：

```js
cv.solvePnPRansac(..., 50, 5.0, 0.99, ...)
```

也就是说，即便进入光流追踪，你还是**每帧做一次 RANSAC PnP**。

OpenCV 文档说 `solvePnPRansac` 是用 RANSAC 处理坏匹配，参数里有 `iterationsCount`、`reprojectionError`、`confidence`，它适合重定位/抗错误匹配，但不适合每帧低延迟追踪都跑。OpenCV 也说明 `solvePnPRefineLM` 是从已有初始姿态继续优化，用于已有姿态基础上的 refinement。([docs.opencv.org][1])

你的正确结构应该是：

```text
识别 / 重定位：
  ORB + Homography + solvePnPRansac

稳定追踪：
  LK Optical Flow + solvePnP(useExtrinsicGuess=true)
  或 solvePnP + solvePnPRefineLM
  不要每帧 RANSAC

周期校正：
  每 8~15 帧跑一次 ORB / RANSAC
```

### 建议改法

给 `solvePoseFromArrays()` 增加一个参数：

```js
function solvePoseFromArrays(
  objPointList,
  imgPointList,
  minPoints,
  poseConfidenceSource,
  statusPrefix = 'Success',
  useExtrinsicGuess = false,
  useRansac = false
) {
  // ...
}
```

光流模式调用：

```js
const poseResult = solvePoseFromArrays(
  nextObjPoints,
  nextFramePoints,
  config.flowMinPoints,
  poseConfidenceSource,
  'Success (Flow)',
  true,
  false // 光流追踪阶段不要每帧 RANSAC
);
```

内部逻辑：

```js
if (useRansac && cv.solvePnPRansac) {
    success = cv.solvePnPRansac(...);
} else {
    success = cv.solvePnP(
        objPointsMat,
        imgPointsMat,
        cameraMatrixMat,
        distCoeffsMat,
        rvec,
        tvec,
        useExtrinsicGuess,
        cv.SOLVEPNP_ITERATIVE
    );

    if (success && cv.solvePnPRefineLM) {
        cv.solvePnPRefineLM(
            objPointsMat,
            imgPointsMat,
            cameraMatrixMat,
            distCoeffsMat,
            rvec,
            tvec
        );
    }
}
```

这里的核心思想是：**RANSAC 用来“找回来”，不是用来“每帧跟手”。**

---

## 3. 第三处硬伤：`renderer.setAnimationLoop()` 同时做 CV 和渲染，主线程被绑死

你现在是：

```js
renderer.setAnimationLoop(() => {
    if (currentMode === 'AR') {
        processFrame();
        renderer.render(scene, camera);
    }
});
```

也就是：

```text
WebGL 渲染
OpenCV 计算
DOM 更新
Canvas 读取
视频帧处理
```

全在主线程同一个 loop 里。

MDN 对 `requestVideoFrameCallback()` 的说明很适合你这个场景：它会在新的 video frame 送往 compositor 时回调，适合视频处理、视频分析、canvas 绘制；并且它按视频帧率触发，而不是盲目跟显示器 60Hz 走。MDN 也提醒这个 API 仍在主线程运行，但它至少能让你**不要重复处理同一帧视频**。([developer.mozilla.org][2])

### 你现在的问题

如果摄像头实际 30fps，屏幕 60fps，你的 `setAnimationLoop` 可能会：

```text
同一张 camera frame 被处理两次
OpenCV 白跑
渲染被 CV 阻塞
用户看到延迟
```

### 建议改成双循环

渲染循环只负责渲染：

```js
renderer.setAnimationLoop(() => {
    if (currentMode === 'AR') {
        renderer.render(scene, camera);
    } else {
        orbitControls.update();
        renderer.render(scene, previewCamera);
    }
});
```

视频处理单独走：

```js
function startVideoProcessingLoop() {
    if ('requestVideoFrameCallback' in cameraVideo) {
        const onFrame = () => {
            if (currentMode === 'AR') {
                processFrame();
            }
            cameraVideo.requestVideoFrameCallback(onFrame);
        };
        cameraVideo.requestVideoFrameCallback(onFrame);
    } else {
        setInterval(() => {
            if (currentMode === 'AR') processFrame();
        }, 1000 / 30);
    }
}
```

然后在 `initAR()` 完成初始化后调用：

```js
startVideoProcessingLoop();
```

这一步不一定让单帧计算变快，但能减少“处理旧帧”和“渲染被分析任务卡住”的问题。

---

## 4. 第四处硬伤：每帧 `cv.imread(trackCanvas)` 是明显浪费

你现在每帧：

```js
trackCtx.drawImage(cameraVideo, 0, 0, trackW, trackH);
const tempMat = cv.imread(trackCanvas);
tempMat.copyTo(frameMat);
tempMat.delete();
cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);
```

这会产生：

```text
video → canvas
canvas → ImageData / cv.Mat
tempMat → frameMat copy
RGBA → Gray
```

这里至少有一次多余 copy。你虽然复用了 `frameMat`，但 `cv.imread(trackCanvas)` 每帧仍会创建新 Mat。

### 改法

用 `getImageData` + `frameMat.data.set()`：

```js
trackCtx.drawImage(cameraVideo, 0, 0, trackW, trackH);
const imageData = trackCtx.getImageData(0, 0, trackW, trackH);
frameMat.data.set(imageData.data);
cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);
```

这仍然不是最优，但比每帧 `cv.imread + copyTo + delete` 更直接。

更进一步才是 Worker + OffscreenCanvas。MDN 说明 OffscreenCanvas 可在 Worker 中运行渲染/Canvas 操作，避免重计算阻塞主线程，并且它是 transferable object。([developer.mozilla.org][3])

但我建议顺序是：

```text
先去掉 cv.imread
再拆 requestVideoFrameCallback
最后再上 Worker
```

不要一上来大改 Worker，否则调试复杂度会暴涨。

---

## 5. 第五处硬伤：每帧更新一堆 DOM debug 信息

你的 `updateUIAndRenderer()` 每帧更新大量 DOM：

```js
dbPnpStatus.innerText = ...
dbFrameCost.innerText = ...
dbFlowPoints.innerText = ...
dbRawMatches.innerText = ...
statusText.innerText = ...
statusBadge.className = ...
```

这些不是算法耗时，但会引发布局/样式更新，尤其移动端浏览器上会拖慢主线程。

### 改成 5~10Hz 更新

```js
let lastDebugUpdate = 0;

function shouldUpdateDebugUI() {
    const now = performance.now();
    if (now - lastDebugUpdate > 150) {
        lastDebugUpdate = now;
        return true;
    }
    return false;
}
```

然后：

```js
if (shouldUpdateDebugUI()) {
    updateDebugStats(...);
}
```

状态条 `DETECTED / SCANNING / LOST` 可以继续更新，但 debug 数字没必要每帧刷。

---

## 6. 第六处硬伤：`renderer.setPixelRatio(window.devicePixelRatio)` 在手机上可能太贵

你现在：

```js
renderer.setPixelRatio(window.devicePixelRatio);
```

在很多手机上 `devicePixelRatio` 是 2 或 3。你的 AR 内容其实不是精细 3D 场景，没必要用满 DPR。

改成：

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```

甚至先测试：

```js
renderer.setPixelRatio(1);
```

如果延迟明显下降，说明 WebGL 渲染也在抢主线程/GPU 资源。

---

## 7. LK 光流参数还可以更激进

你现在：

```js
const winSize = new cv.Size(21, 21);
const criteria = new cv.TermCriteria(
  cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
  20,
  0.03
);

cv.calcOpticalFlowPyrLK(..., winSize, 3, criteria);
```

OpenCV 文档说明 `calcOpticalFlowPyrLK` 是稀疏特征点的金字塔 Lucas-Kanade 光流，`winSize` 是搜索窗口，`maxLevel` 是金字塔层数，`criteria` 是迭代终止条件。更大窗口、更高层数、更高迭代次数通常更稳，但更慢。([docs.opencv.org][4])

你现在如果目标是低延迟，可以先试：

```js
const winSize = new cv.Size(15, 15);
const criteria = new cv.TermCriteria(
  cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
  10,
  0.03
);

cv.calcOpticalFlowPyrLK(
  prevFlowGray,
  frameGray,
  prevPtsMat,
  nextPtsMat,
  statusMat,
  errMat,
  winSize,
  2,
  criteria
);
```

也就是说：

```text
窗口 21 → 15
金字塔层 3 → 2
迭代 20 → 10
```

这会牺牲一部分大幅运动稳定性，但延迟会下降。

---

# 我建议你接下来按这个顺序改

## 第一优先级：确认是不是“平滑延迟”

先做这两个改动：

```js
lerpFactor: 0.45
```

并且光流模式下直接 copy：

```js
if (flowState === 'TRACKING_FLOW') {
    currentPos.copy(targetPos);
    currentQuat.copy(targetQuat);
} else {
    currentPos.lerp(targetPos, 0.35);
    currentQuat.slerp(targetQuat, 0.35);
}
```

如果这一步后延迟明显下降，说明你之前主要问题不是 OpenCV，而是姿态滤波太重。

---

## 第二优先级：光流阶段取消每帧 RANSAC

改成：

```text
TRACKING_FLOW:
  LK optical flow
  solvePnP(useExtrinsicGuess=true)
  optional solvePnPRefineLM

RELOCALIZING / SCANNING:
  ORB
  Homography
  solvePnPRansac
```

这一步会明显降低每帧计算成本。

---

## 第三优先级：拆分视频处理和渲染

用：

```js
cameraVideo.requestVideoFrameCallback(process)
```

替代在 `renderer.setAnimationLoop()` 里每帧跑 `processFrame()`。

渲染保持 60fps，视频分析跟摄像头帧率走。

---

## 第四优先级：减少每帧内存分配

重点改：

```js
cv.imread(trackCanvas)
```

替换成：

```js
const imageData = trackCtx.getImageData(0, 0, trackW, trackH);
frameMat.data.set(imageData.data);
```

然后继续看 `Frame Cost`。

---

## 第五优先级：降低 UI 和 WebGL 压力

做：

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```

debug 面板 150ms 更新一次。

---

# 你可以新增一个性能分解面板

现在只有总的 `Frame Cost`，不够。你应该分解成：

```text
drawCost
grayCost
flowCost
orbCost
matchCost
pnpCost
renderCost
uiCost
```

示例：

```js
const perf = {};

let t = performance.now();
trackCtx.drawImage(cameraVideo, 0, 0, trackW, trackH);
perf.draw = performance.now() - t;

t = performance.now();
const imageData = trackCtx.getImageData(0, 0, trackW, trackH);
frameMat.data.set(imageData.data);
cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);
perf.gray = performance.now() - t;

t = performance.now();
const flowResult = tryTrackWithOpticalFlow();
perf.flow = performance.now() - t;
```

然后你就能判断：

```text
如果 flowCost 高：调 LK 参数 / 限制点数
如果 pnpCost 高：取消每帧 RANSAC
如果 draw/gray 高：改 OffscreenCanvas / Worker
如果 uiCost 高：降 debug 更新频率
如果 render 高：降 DPR / 降几何段数
```

没有这个分解，你就是凭感觉调。

---

# 更深一层：你现在还没有真正做“预测补偿”

商业 AR 不只是低延迟计算，还会做一点预测。你的 pipeline 是：

```text
拿到当前帧
计算姿态
渲染姿态
```

但当用户看到画面时，姿态已经落后了几十毫秒。MDN 对 `requestVideoFrameCallback()` 的 metadata 里有 `expectedDisplayTime`、`presentationTime`、`presentedFrames`，这些可以用来判断当前处理是否已经晚了一个 vsync。([developer.mozilla.org][2])

后面可以加简单预测：

```js
predictedPos = currentPos + velocity * predictMs
predictedQuat = angularVelocity extrapolate predictMs
```

先不用复杂卡尔曼滤波。你可以保存最近两次姿态：

```js
poseVelocity = (targetPos - lastTargetPos) / dt
predictedTarget = targetPos + poseVelocity * 0.025
```

预测 16~33ms 就够，不要预测太多，否则会抖。

---

# 最后给你一个明确结论

`doc/recommend.md` 的建议偏“系统级正确”，但你现在的瓶颈更具体：

```text
1. lerpFactor=0.04 人为制造了 300~500ms 级别的视觉滞后
2. TRACKING_FLOW 里每帧 solvePnPRansac，计算太重
3. CV 和 WebGL 渲染绑在 setAnimationLoop 主线程里
4. cv.imread(trackCanvas) 每帧创建 Mat，内存和 copy 压力大
5. debug DOM 每帧更新，移动端会拖慢
6. renderer 使用完整 devicePixelRatio，手机上 GPU 压力偏高
```

我的建议是你下一版不要继续大改曲面模型，先做一个 **low-latency branch**：

```text
A. 光流成功时 currentPose 直接 copy targetPose
B. 光流阶段禁用 RANSAC，只用 solvePnP(useExtrinsicGuess=true)
C. requestVideoFrameCallback 驱动 processFrame
D. 去掉 cv.imread，改 ImageData → frameMat.data.set
E. debug UI 降到 150ms 更新一次
F. pixelRatio 限制到 1 或 1.5
```

这 6 个改完，如果还慢，再上 Worker / OffscreenCanvas / 自编译 SIMD OpenCV.js。否则你现在直接上更复杂的算法，很可能只是把延迟问题藏得更深。

[1]: https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html "OpenCV: Camera Calibration and 3D Reconstruction"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback "HTMLVideoElement: requestVideoFrameCallback() method - Web APIs | MDN"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas "OffscreenCanvas - Web APIs | MDN"
[4]: https://docs.opencv.org/4.x/dc/d6b/group__video__track.html "OpenCV: Object Tracking"
