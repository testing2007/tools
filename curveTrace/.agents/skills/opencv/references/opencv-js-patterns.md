# OpenCV.js Patterns

## Contents

- Runtime initialization
- Image and frame ingestion
- Mat types and typed arrays
- Feature extraction and matching
- Geometric filtering and pose estimation
- Optical flow
- WASM memory management
- Error handling and performance

## Runtime Initialization

OpenCV.js initialization depends on the build. Inspect the shipped file and use the contract it actually exposes.

### Promise-based Worker build

```js
importScripts('/libs/opencv.js');

self.cv.then((cvInstance) => {
    cv = cvInstance;
    self.postMessage({ type: 'cvReady' });
}).catch((err) => {
    self.postMessage({
        type: 'error',
        message: `OpenCV init failed: ${err?.message || String(err)}`
    });
});
```

### Module callback build

```js
self.Module = {
    onRuntimeInitialized() {
        self.postMessage({ type: 'cvReady' });
    }
};
importScripts('/libs/opencv.js');
```

### Runtime probe

```js
const required = ['Mat', 'BFMatcher', 'solvePnP'];
for (const name of required) {
    if (!cv[name]) throw new Error(`OpenCV API missing: cv.${name}`);
}
if (!cv.ORB) throw new Error('OpenCV build does not include ORB');
```

Do not mix initialization styles by assumption. A custom modularized Emscripten build can look similar to an official build while exposing a different return value.

## Image and Frame Ingestion

Browser canvas and `ImageData` use RGBA channel order.

### Reusable frame Mat

```js
let frameMat = new cv.Mat(height, width, cv.CV_8UC4);
let frameGray = new cv.Mat();

function loadFrame(arrayBuffer) {
    const pixels = new Uint8ClampedArray(arrayBuffer);
    if (pixels.length !== width * height * 4) {
        throw new Error(`Unexpected frame size: ${pixels.length}`);
    }
    frameMat.data.set(pixels);
    cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);
}
```

Prefer this path in a frame loop over repeated `cv.imread(canvas)` allocations.

### Reference image in a Worker

```js
const response = await fetch(url);
if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

const bitmap = await createImageBitmap(await response.blob());
const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
const context = canvas.getContext('2d');
context.drawImage(bitmap, 0, 0);
const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

const rgba = cv.matFromArray(
    bitmap.height,
    bitmap.width,
    cv.CV_8UC4,
    imageData.data
);
const gray = new cv.Mat();
try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    // Use gray synchronously or clone data that must survive.
} finally {
    rgba.delete();
    gray.delete();
    bitmap.close?.();
}
```

## Mat Types and Typed Arrays

Common mappings:

| Mat type | Typical use | Typed view |
| --- | --- | --- |
| `CV_8UC1` | grayscale, ORB descriptors, masks | `data` |
| `CV_8UC4` | browser RGBA pixels | `data` |
| `CV_32F` | scalar point matrices | `data32F` |
| `CV_32FC2` | packed 2D points for flow/homography | `data32F` |
| `CV_64F` | camera matrix, rotation, translation | `data64F` |

Match the shape expected by the binding:

```js
const objectPoints = cv.matFromArray(count, 3, cv.CV_32F, xyz);
const imagePoints = cv.matFromArray(count, 2, cv.CV_32F, xy);
const flowPoints = cv.matFromArray(count, 1, cv.CV_32FC2, xy);
```

Validate before native calls:

```js
function requireGray8(mat, label) {
    if (!mat || mat.empty()) throw new Error(`${label}: empty Mat`);
    if (mat.type() !== cv.CV_8UC1) {
        throw new Error(`${label}: expected CV_8UC1, got ${mat.type()}`);
    }
}
```

## Feature Extraction and Matching

### ORB

```js
const orb = cv.ORB.create ? cv.ORB.create(1200) : new cv.ORB(1200);
const keypoints = new cv.KeyPointVector();
const descriptors = new cv.Mat();
const mask = new cv.Mat();

try {
    requireGray8(gray, 'ORB input');
    orb.detectAndCompute(gray, mask, keypoints, descriptors);
    if (descriptors.empty() || descriptors.type() !== cv.CV_8U) {
        throw new Error('ORB produced no valid binary descriptors');
    }
} finally {
    mask.delete();
    keypoints.delete();
    descriptors.delete();
    orb.delete();
}
```

Keep ORB and an empty reusable mask alive across frames when practical.

### KNN Hamming matching

```js
const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
const rows = new cv.DMatchVectorVector();
const accepted = [];

try {
    matcher.knnMatch(queryDescriptors, trainDescriptors, rows, 2);
    for (let i = 0; i < rows.size(); i++) {
        const row = rows.get(i);
        let first = null;
        let second = null;
        try {
            if (row.size() < 1) continue;
            first = row.get(0);
            if (row.size() >= 2) second = row.get(1);

            const ratioOk = !second || first.distance <= second.distance * 0.82;
            if (ratioOk && first.distance <= 70) {
                accepted.push({
                    queryIdx: first.queryIdx,
                    trainIdx: first.trainIdx,
                    distance: first.distance
                });
            }
        } finally {
            first?.delete?.();
            second?.delete?.();
            row?.delete?.();
        }
    }
} finally {
    rows.delete();
    matcher.delete();
}
```

Sort accepted matches by distance, remove repeated object/image locations, and limit the set before geometry estimation.

## Geometric Filtering and Pose Estimation

### Homography RANSAC

Use homography only when reference coordinates are meaningfully planar. It is a correspondence filter, not the final 3D pose.

```js
const src = cv.matFromArray(count, 1, cv.CV_32FC2, referenceXY);
const dst = cv.matFromArray(count, 1, cv.CV_32FC2, frameXY);
const inlierMask = new cv.Mat();
let homography = null;

try {
    homography = cv.findHomography(src, dst, cv.RANSAC, 6.0, inlierMask);
    if (!homography || homography.empty()) {
        throw new Error('Homography estimation failed');
    }
} finally {
    src.delete();
    dst.delete();
    inlierMask.delete();
    homography?.delete?.();
}
```

Require enough inliers and sufficient image-space width and height. Clustered points produce unstable pose even when the count is high.

### Camera matrix

```js
const cameraMatrix = new cv.Mat(3, 3, cv.CV_64F);
const d = cameraMatrix.data64F;
d.set([
    fx, 0, cx,
    0, fy, cy,
    0, 0, 1
]);
const distCoeffs = cv.Mat.zeros(4, 1, cv.CV_64F);
```

Use calibrated intrinsics when available. Approximate focal lengths are tuning parameters, not universal constants.

### solvePnP

```js
const rvec = new cv.Mat();
const tvec = new cv.Mat();

const ok = cv.solvePnP(
    objectPoints,
    imagePoints,
    cameraMatrix,
    distCoeffs,
    rvec,
    tvec,
    useExtrinsicGuess,
    cv.SOLVEPNP_ITERATIVE
);

if (ok && cv.solvePnPRefineLM) {
    cv.solvePnPRefineLM(
        objectPoints,
        imagePoints,
        cameraMatrix,
        distCoeffs,
        rvec,
        tvec
    );
}
```

Use `cv.projectPoints` to compute reprojection error. Reject non-finite outputs, high average error, impossible depth, physical-bound violations, and abrupt temporal jumps.

OpenCV camera coordinates typically use X right, Y down, and Z forward. Three.js uses a different world/camera convention. Convert rotation and translation explicitly and test with known poses.

## Optical Flow

Use sparse pyramidal Lucas-Kanade after a successful recognition result seeds stable frame points and their matching 3D points.

```js
const previous = cv.matFromArray(count, 1, cv.CV_32FC2, previousXY);
const next = new cv.Mat();
const status = new cv.Mat();
const error = new cv.Mat();
const winSize = new cv.Size(15, 15);
const criteria = new cv.TermCriteria(
    cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
    10,
    0.03
);

try {
    cv.calcOpticalFlowPyrLK(
        previousGray,
        currentGray,
        previous,
        next,
        status,
        error,
        winSize,
        2,
        criteria
    );
} finally {
    previous.delete();
    next.delete();
    status.delete();
    error.delete();
}
```

Keep only points whose status is 1, coordinates are finite and in bounds, and optional flow error passes a threshold. Relocalize when the surviving count or ratio drops below the configured minimum.

## WASM Memory Management

Use one owner per embind object.

```js
let temporary = null;
try {
    temporary = new cv.Mat();
    // OpenCV operations
} finally {
    temporary?.delete?.();
}
```

Common leak sources:

- Early returns before `.delete()`.
- Replacing a persistent Mat without deleting the old one.
- Objects returned by `KeyPointVector.get()` or match-vector `get()`.
- Retaining reference pyramids after loading a new target.
- Repeatedly constructing ORB, matchers, masks, and frame Mats.
- Treating a Mat's typed view as valid after deleting the Mat.

When reloading reference levels, release every old level's keypoints and descriptors before replacing the array.

## Error Handling and Performance

OpenCV.js can throw JavaScript `Error` objects or numeric exception pointers.

```js
function formatCvError(error) {
    if (typeof error === 'number' && cv?.exceptionFromPtr) {
        try {
            const decoded = cv.exceptionFromPtr(error);
            return decoded?.msg || decoded?.message || `OpenCV exception ${error}`;
        } catch {}
    }
    return error?.message || String(error);
}
```

Measure major stages independently:

- frame copy and grayscale conversion,
- ORB extraction,
- descriptor matching and homography,
- optical flow,
- PnP and reprojection.

Optimize in this order:

1. Stop frame backlog.
2. Remove repeated allocations and copies.
3. Avoid ORB on frames where flow remains healthy.
4. Limit features and correspondence counts.
5. Throttle full multi-scale scans.
6. Reduce tracking resolution only after geometry and lifecycle are correct.
