---
name: opencv
description: Design, implement, debug, and optimize OpenCV.js computer-vision pipelines in browsers and Web Workers, especially WASM Mat lifecycle, image and video frame ingestion, ORB feature matching, homography filtering, solvePnP pose estimation, Lucas-Kanade optical flow, and real-time WebAR tracking. Use when editing cv-worker.js, opencv.js loading code, browser camera processing, feature matching, pose tracking, or OpenCV.js memory and performance issues; also use for related OpenCV API questions where JavaScript behavior differs from Python or C++.
---

# OpenCV.js Engineering

Build browser vision code as an explicit pipeline with known input formats, owned WASM objects, geometric validation, and measurable stage timings.

## Start With Runtime Discovery

1. Inspect how `opencv.js` is built and loaded before writing initialization code.
2. Determine whether the build exposes:
   - a ready `cv` object,
   - `Module.onRuntimeInitialized`,
   - a Promise such as `self.cv`,
   - embedded `SINGLE_FILE` WASM or a separate `.wasm` asset.
3. Probe required APIs at runtime, such as `cv.Mat`, `cv.ORB`, `cv.BFMatcher`, `cv.solvePnP`, and `cv.calcOpticalFlowPyrLK`.
4. Treat project-local binding patches as build-specific. Do not copy them into a standard OpenCV.js distribution without reproducing the failure.

For loading patterns, Mat types, and API recipes, read [references/opencv-js-patterns.md](references/opencv-js-patterns.md).

## Follow the Processing Workflow

1. Define the source format and dimensions.
   - Browser `ImageData` and canvas pixels are RGBA.
   - Camera frame buffers must contain exactly `width * height * 4` bytes.
2. Convert once into the representation needed by the algorithm.
   - Use `cv.COLOR_RGBA2GRAY` for browser RGBA input.
   - Keep ORB input as non-empty `CV_8UC1`.
3. Validate data before expensive native calls.
   - Check Mat size, type, descriptor rows and columns, finite coordinates, point counts, and spatial spread.
4. Separate recognition from tracking.
   - Use ORB matching and geometric filtering to acquire or relocalize.
   - Use sparse LK optical flow for low-latency frame-to-frame tracking.
5. Estimate pose only from valid 3D-to-2D correspondences.
   - Keep object and image point ordering identical.
   - Build and calibrate the camera matrix explicitly.
   - Reject high reprojection error and implausible pose jumps.
6. Return compact structured results to the main thread.
   - Include success, state, pose, confidence, inlier count, reprojection error, timings, and a readable failure status.

## Enforce WASM Ownership

- Call `.delete()` on every temporary `cv.Mat`, `KeyPointVector`, `DMatchVectorVector`, and other embind object.
- Use `try/finally` around allocations that cross fallible OpenCV calls.
- Delete objects returned by vector `.get()` when the binding gives them independent ownership.
- Reuse long-lived frame Mats, camera matrices, masks, descriptors, and solver outputs when dimensions and types remain stable.
- Delete old objects before replacing persistent state.
- Never rely on JavaScript garbage collection to release WASM heap memory.
- Copy typed-array data out before deleting a Mat if JavaScript must retain the values.

## Keep Real-Time Work Off the Main Thread

- Run OpenCV frame processing in a dedicated Worker when the pipeline is non-trivial.
- Transfer the frame `ArrayBuffer` with a transfer list.
- Keep at most one frame in flight unless the pipeline intentionally implements a bounded queue.
- Drop stale frames under load; do not build latency by queueing every camera frame.
- Buffer control messages until OpenCV initialization completes.
- Keep rendering, UI, and Three.js state on the main thread.

## Match Algorithms to Data

- Use ORB descriptors with Hamming distance, not L2.
- Prefer `knnMatch(..., 2)` plus a ratio test and an absolute Hamming cutoff for ambiguous scenes.
- Filter duplicate or invalid correspondences before geometry estimation.
- Use homography RANSAC as a planar consistency filter when the reference image is approximately planar.
- Require adequate 2D point spread before `solvePnP`; a large count of clustered points is still degenerate.
- Use `solvePnPRefineLM` only after a successful initial solve.
- Evaluate pose with reprojection error, inlier ratio, temporal continuity, and physical bounds rather than a single match-count threshold.

## Diagnose in Pipeline Order

Check failures in this order:

1. OpenCV runtime and required symbols.
2. Frame byte length, dimensions, color conversion, Mat type, and empty Mats.
3. Reference feature count and frame feature count.
4. Descriptor type, width, and raw versus filtered match counts.
5. Homography inliers and spatial coverage.
6. PnP point count, camera intrinsics, coordinate conventions, and reprojection error.
7. Optical-flow survival ratio and drift.
8. WASM memory growth, stale embind objects, and frame backlog.

Decode numeric OpenCV exceptions with `cv.exceptionFromPtr` when available. Preserve both a user-readable status and the raw diagnostic.

## Work in This Repository

For CurveTrace architecture, Worker messages, state transitions, tuning order, and file locations, read [references/curvetrace-workflow.md](references/curvetrace-workflow.md).

When modifying this repository:

- Treat `cv-worker.js` as the owner of all OpenCV state.
- Preserve the pre-ready message queue and `cvReady` handshake.
- Preserve the reusable frame Mat path: transferred RGBA buffer to `frameMat.data`, then `RGBA2GRAY`.
- Keep temporary object deletion in the same function that allocates the object.
- Add or update stage timing fields when adding expensive work.
- Run syntax validation and exercise initialization, reference loading, scanning, tracking, loss, and relocalization paths.

## Verification Checklist

- Confirm the OpenCV build reaches the ready state and exposes every required API.
- Confirm reference loading reports non-zero keypoints.
- Confirm frame processing does not queue unbounded work.
- Confirm temporary WASM objects are released on success, early return, and exception paths.
- Confirm ORB acquisition transitions to optical-flow tracking.
- Confirm failed flow transitions through relocalization or loss without freezing the last pose indefinitely.
- Confirm pose acceptance uses reprojection and continuity checks.
- Compare stage timings and WASM memory behavior before and after performance changes.
