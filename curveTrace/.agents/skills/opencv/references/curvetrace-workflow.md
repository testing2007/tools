# CurveTrace OpenCV Workflow

## Contents

- Ownership and files
- Initialization
- Worker message protocol
- Recognition and tracking pipeline
- Coordinate mapping
- Configuration
- Safe change procedure
- Troubleshooting

## Ownership and Files

- `cv-worker.js`: owns OpenCV.js initialization, Mats, ORB, matching, optical flow, PnP, state transitions, diagnostics, and pose output.
- `impl.html`: owns camera capture, frame transfer, target and GLB loading, configuration UI, Three.js rendering, and Worker result application.
- `libs/opencv.js`: custom self-compiled Emscripten `SINGLE_FILE` OpenCV.js build.
- `compile-server.js`: serves the local application.
- `inspect_cv.js`: inspects generated OpenCV.js bindings during build debugging.

Do not move OpenCV frame processing back to the main thread.

## Initialization

`cv-worker.js` loads `/libs/opencv.js` with `importScripts`. In the current custom build, `self.cv` is a Promise resolving to the module instance.

The generated helper bindings close over the wrong `cv` value, so this repository replaces `matFromArray` and `matFromImageData` after the Promise resolves. This is a local build workaround. Keep it only while the generated binding defect remains reproducible.

Initialization order:

1. Import OpenCV.js.
2. Await `self.cv`.
3. Assign the resolved module to the Worker-level `cv`.
4. Apply build-specific helper patches.
5. Allocate reusable OpenCV state.
6. Drain messages received before readiness.
7. post `cvReady`.

## Worker Message Protocol

### Main thread to Worker

| Type | Important fields | Effect |
| --- | --- | --- |
| `loadRef` | `url` | Fetch reference image and build multi-scale ORB levels |
| `frame` | `pixels`, `frameWidth`, `frameHeight`, timing metadata | Process one RGBA camera frame |
| `updateConfig` | `config`, `reinitOrb`, `reinit3DPoints` | Apply tuning and selectively rebuild state |
| `modelPoints` | `levels`, `poseBounds` | Replace analytic 3D points with GLB-derived points |
| `reset` | none | Return tracking to `SCANNING` |

### Worker to main thread

| Type | Important fields | Effect |
| --- | --- | --- |
| `cvReady` | none | OpenCV state is ready |
| `refLoaded` | dimensions, levels, keypoint counts | Reference features are ready |
| `modelPointsApplied` | level count | GLB point mapping is active |
| `poseResult` | pose, state, confidence, counts, errors, timings | Render and update diagnostics |
| `error` | `message` | Release `workerBusy` and report failure |

The main thread transfers `ImageData.data.buffer` and sets `workerBusy`. It does not send another frame until `poseResult` or `error` clears the flag. Preserve this stale-frame dropping behavior.

## Recognition and Tracking Pipeline

### Reference preparation

`loadRefFromImage`:

1. Fetches the target image.
2. Decodes it with `createImageBitmap`.
3. Reads RGBA pixels through `OffscreenCanvas`.
4. Converts to grayscale.
5. Builds ORB features for scales `1.0`, `0.75`, `0.5`, `0.35`, `0.25`, and `0.18`.
6. Stores keypoints, descriptors, original pixel coordinates, match coordinates, and mapped 3D points.

When replacing reference data, release keypoints and descriptors from old levels before discarding them.

### Frame preparation

`processFrameInWorker`:

1. Reconfigures reusable Mats when frame size changes.
2. Validates the transferred RGBA byte count.
3. Copies bytes into reusable `frameMat`.
4. Converts into reusable grayscale `frameGray`.
5. Lazily computes ORB features only if the active state needs them.

### State machine

- `SCANNING`: throttle full multi-scale ORB searches.
- `TRACKING_FLOW`: run LK optical flow and solve PnP from surviving tracked points.
- `RELOCALIZING`: try ORB against the last successful reference level.
- `LOST`: throttle full scans until acquisition succeeds.

Successful ORB/PnP seeds flow with matched 3D object points and current 2D frame points. Failed flow transitions to relocalization. Relocalization persistence can temporarily preserve display state, but must eventually become `LOST`.

### ORB acquisition

1. Validate grayscale input.
2. Extract frame ORB features once for the current frame.
3. Match each reference level with `BFMatcher(NORM_HAMMING)`.
4. Apply ratio and absolute-distance filters.
5. Sort and cap matches.
6. Apply homography RANSAC.
7. Deduplicate object and image points.
8. Require adequate point count and 2D spread.
9. Solve PnP and optionally refine.
10. Reject high reprojection error or pose jumps.

### Flow tracking

1. Pack previous frame points as `CV_32FC2`.
2. Run `calcOpticalFlowPyrLK`.
3. Keep status-1, finite, in-bounds points.
4. Require minimum count and survival ratio.
5. Solve PnP with the corresponding persistent 3D points.
6. Update previous grayscale frame only after successful pose.
7. Trigger occasional ORB correction when reprojection drifts or a safety interval expires.

## Coordinate Mapping

Reference keypoints need a 3D object point for PnP.

The analytic curved-label fallback maps image pixels to a tapered cylinder:

```text
xArc = (u / width - 0.5) * physicalLabelWidth
Y = (0.5 - v / height) * physicalLabelHeight
r = radiusTop * (1 - t) + radiusBottom * t
theta = xArc / r
X = r * sin(theta)
Z = r * cos(theta)
```

Prefer GLB-derived points when the main thread supplies one point per reference keypoint for every level. Reject the supplied mapping when level or point counts differ.

Keep these coordinate systems explicit:

- reference-image pixels,
- current-frame pixels,
- OpenCV object coordinates,
- OpenCV camera coordinates,
- Three.js world and camera coordinates,
- mirrored display or mirrored reference coordinates.

CSS mirroring changes display only. Do not silently mirror pixels used by PnP unless the corresponding reference and 3D mapping are transformed consistently.

## Configuration

Key groups:

- Recognition: `orbMaxFeatures`, `hammingCutoff`, `minMatches`.
- Flow: `flowMinPoints`, `flowMinRatio`.
- Relocalization: `orbRelocalizeInterval`, `relocalizePersistence`.
- Camera: `fxScale`, `fyScale`, `cxRatio`, `cyRatio`, fallback `fovScale`.
- Geometry: `radiusTop`, `radiusBottom`, `labelPhysicalWidth`, `labelPhysicalHeight`, `usePhysicalDims`.

Apply changes selectively:

- Set `reinitOrb` only when ORB construction parameters change.
- Recompute camera intrinsics when focal or principal-point values change.
- Set `reinit3DPoints` when physical geometry changes.
- Reset tracking when point correspondence semantics change.

Tune in this order:

1. Physical target dimensions or GLB point mapping.
2. Camera intrinsics.
3. Reference image quality and feature coverage.
4. Match filtering and PnP acceptance.
5. Flow thresholds and correction intervals.
6. Visual smoothing.

Do not compensate for wrong geometry by loosening match thresholds.

## Safe Change Procedure

1. Locate the stage and its owner.
2. Identify all OpenCV allocations in the changed path.
3. Preserve cleanup for success, early return, retry, and exception.
4. Preserve Worker handshake and `workerBusy` release behavior.
5. Add a diagnostic field when introducing a new rejection rule.
6. Validate JavaScript syntax.
7. Run the local server.
8. Exercise:
   - OpenCV ready,
   - reference load,
   - initial scanning,
   - successful acquisition,
   - sustained flow,
   - target loss,
   - relocalization,
   - reset,
   - frame-size change.
9. Compare `lastGrayTime`, `lastOrbTime`, `lastFlowTime`, `lastPnpTime`, frame latency, match counts, flow ratio, and reprojection error.

## Troubleshooting

### `cv.Mat` is undefined

- Confirm whether `cv` is a Promise, factory, module instance, or global object.
- Inspect the custom generated wrapper.
- Apply the project helper patch only if the closure-binding defect is present.

### Numeric exception or WASM memory access error

- Decode with `exceptionFromPtr`.
- Validate Mat type, shape, and lifetime.
- Ensure no typed view or embind object is used after deletion.
- Retry ORB only with a compact clone when the project-specific workaround applies.
- Reinitialize the affected algorithm object after a reproducible WASM fault.

### Many matches but unstable pose

- Inspect homography inliers rather than raw matches.
- Deduplicate correspondences.
- Check 2D spatial spread.
- Verify object-point geometry and camera intrinsics.
- Reject by reprojection error and temporal continuity.

### Smooth flow that drifts

- Shorten correction intervals only after checking geometry.
- Correct when reprojection error rises.
- Remove weak flow points.
- Relocalize instead of preserving a visibly wrong pose.

### Increasing latency

- Confirm only one frame is in flight.
- Do not queue camera frames.
- Avoid `cv.imread` and repeated Mat construction in the frame loop.
- Run ORB lazily and throttle multi-scale scans.

### Growing WASM memory

- Audit every `new cv.*`, factory call, vector `.get()`, and `matFromArray`.
- Check reference reload cleanup.
- Check early returns in matching, homography, PnP, and flow functions.
- Reuse persistent buffers where dimensions are stable.
