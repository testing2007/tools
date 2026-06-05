/**
 * cv-worker.js
 * All OpenCV tracking logic runs in this Web Worker thread.
 * Main thread sends raw pixel data; worker returns pose results.
 */
'use strict';

// ============================================================
// OpenCV Initialization
// ============================================================

let cvIsReady = false;
const pendingMessages = [];

var cv; // assigned after Module.onRuntimeInitialized

// Load local opencv.js (self-compiled SINGLE_FILE WASM, Emscripten 5.x)
// Structure: outer cv = async function, UMD factory does `return cv(Module)` → Promise
// All bindings (matFromArray etc.) close over outer `cv` (async fn), NOT Module.
// So cv.Mat is undefined inside bindings. We fix this after Promise resolves.
importScripts('/libs/opencv.js');

// self.cv is now a Promise (UMD factory returned cv(Module)).
// When it resolves, cvInstance = Module, which has Mat, ORB, solvePnP etc.
// BUT: opencv.js binding code closes over the outer `cv` (async fn) which has NO Mat.
// We fix this by re-implementing the broken binding functions using cvInstance directly.

self.cv.then(function (cvInstance) {
    console.log('[Worker] cv resolved. Mat=' + (typeof cvInstance.Mat) +
        ' ORB=' + (typeof cvInstance.ORB) +
        ' solvePnP=' + (typeof cvInstance.solvePnP));

    // cvInstance = Module.  All opencvjs APIs are on cvInstance.
    cv = cvInstance;
    self.cv = cvInstance;

    // ─── CRITICAL PATCH ─────────────────────────────────────────────────────
    // The binding functions (matFromArray, matFromImageData, etc.) use the
    // internal closure variable `cv` (= the async function, NOT Module).
    // That `cv` never gets Mat assigned, so `new cv.Mat()` throws.
    // We override those functions with correct versions using our `cvInstance`.
    // -------------------------------------------------------------------------
    cvInstance['matFromArray'] = function matFromArray(rows, cols, type, array) {
        var mat = new cvInstance.Mat(rows, cols, type);
        switch (type) {
            case cvInstance.CV_8U: case cvInstance.CV_8UC1: case cvInstance.CV_8UC2:
            case cvInstance.CV_8UC3: case cvInstance.CV_8UC4:
                mat.data.set(array); break;
            case cvInstance.CV_8S: case cvInstance.CV_8SC1: case cvInstance.CV_8SC2:
            case cvInstance.CV_8SC3: case cvInstance.CV_8SC4:
                mat.data8S.set(array); break;
            case cvInstance.CV_16U: case cvInstance.CV_16UC1: case cvInstance.CV_16UC2:
            case cvInstance.CV_16UC3: case cvInstance.CV_16UC4:
                mat.data16U.set(array); break;
            case cvInstance.CV_16S: case cvInstance.CV_16SC1: case cvInstance.CV_16SC2:
            case cvInstance.CV_16SC3: case cvInstance.CV_16SC4:
                mat.data16S.set(array); break;
            case cvInstance.CV_32S: case cvInstance.CV_32SC1: case cvInstance.CV_32SC2:
            case cvInstance.CV_32SC3: case cvInstance.CV_32SC4:
                mat.data32S.set(array); break;
            case cvInstance.CV_32F: case cvInstance.CV_32FC1: case cvInstance.CV_32FC2:
            case cvInstance.CV_32FC3: case cvInstance.CV_32FC4:
                mat.data32F.set(array); break;
            case cvInstance.CV_64F: case cvInstance.CV_64FC1: case cvInstance.CV_64FC2:
            case cvInstance.CV_64FC3: case cvInstance.CV_64FC4:
                mat.data64F.set(array); break;
            default: throw new Error('matFromArray: unsupported type ' + type);
        }
        return mat;
    };
    cvInstance['matFromImageData'] = function matFromImageData(imageData) {
        var mat = new cvInstance.Mat(imageData.height, imageData.width, cvInstance.CV_8UC4);
        mat.data.set(imageData.data);
        return mat;
    };
    console.log('[Worker] matFromArray patched successfully');
    // ─────────────────────────────────────────────────────────────────────────

    initCVState();
    cvIsReady = true;
    for (const msg of pendingMessages) handleMessage(msg);
    pendingMessages.length = 0;
    self.postMessage({ type: 'cvReady' });
}).catch(function (err) {
    console.error('[Worker] OpenCV init failed:', err);
    self.postMessage({ type: 'error', message: 'OpenCV init failed: ' + (err && err.message || String(err)) });
});

// ============================================================
// Configuration & Constants
// ============================================================

let trackW = 640;
let trackH = 480;
const REF_LEVEL_SCALES = [1.0, 0.75, 0.5, 0.35, 0.25, 0.18];

let cfg = {
    orbMaxFeatures: 1200,
    flowMinPoints: 12,
    flowMinRatio: 0.45,
    hammingCutoff: 70,
    minMatches: 12,
    orbRelocalizeInterval: 12,
    relocalizePersistence: 1500,
    radiusTop: 1.0,
    radiusBottom: 1.0,
    height: 1.33,
    thetaLength: 73,
    fovScale: 1.05,
    // Physical label dimensions in Three.js units (set by main thread via updateConfig)
    // labelPhysicalWidth  = arc length of label  (labelWidthMm / radiusTopMm)
    // labelPhysicalHeight = label height         (labelHeightMm / radiusTopMm)
    labelPhysicalWidth: 2.4,    // default: 72mm / 30mm
    labelPhysicalHeight: 3.2,   // default: 96mm / 30mm
    usePhysicalDims: true
};

// ============================================================
// OpenCV State Variables
// ============================================================

let orb = null;
let matcher = null;
let maskMat = null;
let cameraMatrixMat = null;
let distCoeffsMat = null;
let rvec = null, tvec = null, RMat = null;
let frameMat = null, frameGray = null, prevFlowGray = null;
let localFrameKeypoints = null, localFrameDescriptors = null;
let computedFrameFeatures = false;
let orbFaultCount = 0;

// Reference image data
let refWidth = 0, refHeight = 0;
let refLevels = [];
let ref3DPoints = [];
let modelPointLevels = null;

// Tracking state
let flowState = 'SCANNING';
let flowObjPoints = [], flowFramePoints = [], flowRefPoints = [];
let flowFrameCounter = 0;
let lastFlowRatio = 0;
let lastSuccessTime = 0;
let lastSuccessScaleLevel = null;
let scanFrameCounter = 0;
let isFirstFrame = true;

// Jump check state (maintained in worker since 20ms extrapolation removed)
let lastCamPos = null;
let lastCamQuat = null;

// Performance timers
let lastGrayTime = 0, lastFlowTime = 0, lastOrbTime = 0, lastPnpTime = 0;

// ============================================================
// CV State Initializer
// ============================================================

function initCVState() {
    maskMat = new cv.Mat();
    frameMat = new cv.Mat(trackH, trackW, cv.CV_8UC4);
    frameGray = new cv.Mat();
    prevFlowGray = new cv.Mat();
    cameraMatrixMat = new cv.Mat(3, 3, cv.CV_64F);
    distCoeffsMat = cv.Mat.zeros(4, 1, cv.CV_64F);
    rvec = new cv.Mat();
    tvec = new cv.Mat();
    RMat = new cv.Mat();
    initTracker();
    initCameraMatrix();
}

function initTracker() {
    const maxFeatures = Number(cfg.orbMaxFeatures) || 500;
    if (orb) { try { orb.delete(); } catch (e) {} }
    if (cv.ORB && cv.ORB.create) {
        orb = cv.ORB.create(maxFeatures);
    } else if (cv.ORB) {
        orb = new cv.ORB(maxFeatures);
    } else {
        throw new Error('cv.ORB not available in this build');
    }
    if (!matcher) {
        matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    }
}

function initCameraMatrix() {
    // Use split intrinsics when available; fall back to single fovScale
    const fxS = Number(cfg.fxScale) || Number(cfg.fovScale) || 1.05;
    const fyS = Number(cfg.fyScale) || fxS;
    const cxR = (cfg.cxRatio != null) ? cfg.cxRatio : 0.5;
    const cyR = (cfg.cyRatio != null) ? cfg.cyRatio : 0.5;

    const fx = trackW * fxS;
    const fy = trackW * fyS;   // use trackW as base for square-pixel assumption
    const cx = trackW * cxR;
    const cy = trackH * cyR;

    const d = cameraMatrixMat.data64F;
    d[0] = fx; d[1] = 0;  d[2] = cx;
    d[3] = 0;  d[4] = fy; d[5] = cy;
    d[6] = 0;  d[7] = 0;  d[8] = 1;
}

function configureFrameSize(width, height) {
    const nextW = Math.max(1, Math.round(Number(width) || trackW));
    const nextH = Math.max(1, Math.round(Number(height) || trackH));
    if (nextW === trackW && nextH === trackH && frameMat && !frameMat.empty()) return;

    trackW = nextW;
    trackH = nextH;
    if (frameMat) { try { frameMat.delete(); } catch (e) {} }
    if (prevFlowGray) { try { prevFlowGray.delete(); } catch (e) {} }
    frameMat = new cv.Mat(trackH, trackW, cv.CV_8UC4);
    prevFlowGray = new cv.Mat();
    initCameraMatrix();
    resetFlowTracking('SCANNING');
    isFirstFrame = true;
    lastCamPos = null;
    lastCamQuat = null;
    console.log(`[Worker] Tracking frame size: ${trackW}x${trackH}`);
}

function formatCvError(err) {
    if (typeof err === 'number') {
        try {
            if (cv && cv.exceptionFromPtr) {
                const ex = cv.exceptionFromPtr(err);
                const msg = ex && (ex.msg || ex.message);
                if (msg) return `OpenCV exception ${err}: ${msg}`;
            }
        } catch (e) {}
        return `OpenCV exception pointer: ${err}`;
    }
    return err && (err.message || err.name) ? (err.message || err.name) : String(err);
}

function isWasmMemoryError(err) {
    const msg = formatCvError(err);
    return /memory access out of bounds|RuntimeError/i.test(msg);
}

function isFiniteNumber(v) {
    return Number.isFinite(Number(v));
}

function hasValidDescriptors(desc) {
    return !!desc
        && !desc.empty()
        && desc.rows > 0
        && desc.cols > 0
        && desc.type
        && desc.type() === cv.CV_8U;
}

function makePointKey2(x, y) {
    return `${Math.round(x * 10)}:${Math.round(y * 10)}`;
}

function makePointKey3(p) {
    return `${Math.round(p.X * 10000)}:${Math.round(p.Y * 10000)}:${Math.round(p.Z * 10000)}`;
}

function validateOrbInput(grayMat, label) {
    if (!grayMat || grayMat.empty()) {
        throw new Error(`${label}: empty grayscale frame`);
    }
    if (grayMat.rows <= 0 || grayMat.cols <= 0) {
        throw new Error(`${label}: invalid grayscale size ${grayMat.cols}x${grayMat.rows}`);
    }
    if (grayMat.type && grayMat.type() !== cv.CV_8UC1) {
        throw new Error(`${label}: expected CV_8UC1, got ${grayMat.type()}`);
    }
}

function detectAndComputeSafe(grayMat, keypoints, descriptors, label) {
    validateOrbInput(grayMat, label);

    let clonedInput = null;
    try {
        orb.detectAndCompute(grayMat, maskMat, keypoints, descriptors);
        orbFaultCount = 0;
    } catch (err) {
        if (!isWasmMemoryError(err)) throw err;

        orbFaultCount++;
        console.warn(`[Worker] ORB wasm fault on ${label}; retrying with compact input (${orbFaultCount})`, err);
        initTracker();

        // OpenCV.js ORB is less forgiving around unusual Mat headers than
        // desktop OpenCV. Retry once with a compact, owned buffer.
        clonedInput = grayMat.clone();
        try {
            orb.detectAndCompute(clonedInput, maskMat, keypoints, descriptors);
            orbFaultCount = 0;
        } catch (retryErr) {
            if (isWasmMemoryError(retryErr)) initTracker();
            throw retryErr;
        }
    } finally {
        if (clonedInput) clonedInput.delete();
    }
}

function collectDescriptorMatches(queryDesc, trainDesc) {
    if (!hasValidDescriptors(queryDesc) || !hasValidDescriptors(trainDesc) || queryDesc.cols !== trainDesc.cols) {
        return { rawCount: 0, filtered: [] };
    }
    if (!matcher) {
        return { rawCount: 0, filtered: [] };
    }

    let knnMatches = null;
    const filtered = [];
    let rawCount = 0;
    try {
        knnMatches = new cv.DMatchVectorVector();
        matcher.knnMatch(queryDesc, trainDesc, knnMatches, 2);
        for (let i = 0; i < knnMatches.size(); i++) {
            const row = knnMatches.get(i);
            let m = null;
            let n = null;
            try {
                if (!row || row.size() < 1) continue;
                m = row.get(0);
                rawCount++;
                let ratioOk = true;
                if (row.size() >= 2) {
                    n = row.get(1);
                    ratioOk = m.distance <= n.distance * 0.82;
                }
                if (ratioOk && m.distance <= cfg.hammingCutoff) {
                    filtered.push({ queryIdx: m.queryIdx, trainIdx: m.trainIdx, distance: m.distance });
                }
            } finally {
                if (m && m.delete) m.delete();
                if (n && n.delete) n.delete();
                if (row && row.delete) row.delete();
            }
        }
    } catch (err) {
        if (isWasmMemoryError(err)) initTracker();
        throw err;
    } finally {
        if (knnMatches) knnMatches.delete();
    }
    return { rawCount, filtered };
}

function buildPnPCorrespondences(level, frameKp, matches, maxMatches) {
    const objPoints = [];
    const imgPoints = [];
    const usedObj = new Set();
    const usedImg = new Set();

    for (const m of matches) {
        if (objPoints.length / 3 >= maxMatches) break;
        const pt3D = level.points3D[m.queryIdx];
        const kp = frameKp.get(m.trainIdx);
        if (!pt3D || !kp || !kp.pt) continue;

        const x = kp.pt.x;
        const y = kp.pt.y;
        if (!isFiniteNumber(pt3D.X) || !isFiniteNumber(pt3D.Y) || !isFiniteNumber(pt3D.Z)
            || !isFiniteNumber(x) || !isFiniteNumber(y)) {
            continue;
        }
        if (x < 0 || x >= trackW || y < 0 || y >= trackH) continue;

        const objKey = makePointKey3(pt3D);
        const imgKey = makePointKey2(x, y);
        if (usedObj.has(objKey) || usedImg.has(imgKey)) continue;
        usedObj.add(objKey);
        usedImg.add(imgKey);

        objPoints.push(pt3D.X, pt3D.Y, pt3D.Z);
        imgPoints.push(x, y);
    }

    return { objPoints, imgPoints, numPts: objPoints.length / 3 };
}

function filterMatchesByHomography(level, frameKp, matches, maxMatches) {
    if (!cv.findHomography || matches.length < 8) {
        return matches.slice(0, maxMatches);
    }

    let srcPts = null;
    let dstPts = null;
    let hmask = null;
    let hMat = null;
    try {
        const src = [];
        const dst = [];
        const candidates = [];
        for (const m of matches) {
            if (candidates.length >= maxMatches) break;
            const refPt = (level.matchPoints || level.originalPoints)[m.queryIdx];
            const kp = frameKp.get(m.trainIdx);
            if (!refPt || !kp || !kp.pt) continue;
            const x = kp.pt.x;
            const y = kp.pt.y;
            if (!isFiniteNumber(refPt.x) || !isFiniteNumber(refPt.y)
                || !isFiniteNumber(x) || !isFiniteNumber(y)) {
                continue;
            }
            if (x < 0 || x >= trackW || y < 0 || y >= trackH) continue;
            src.push(refPt.x, refPt.y);
            dst.push(x, y);
            candidates.push(m);
        }
        if (candidates.length < 8) return candidates;

        srcPts = cv.matFromArray(candidates.length, 1, cv.CV_32FC2, src);
        dstPts = cv.matFromArray(candidates.length, 1, cv.CV_32FC2, dst);
        hmask = new cv.Mat();
        hMat = cv.findHomography(srcPts, dstPts, cv.RANSAC, 6.0, hmask);
        if (!hMat || hMat.empty() || !hmask || hmask.empty()) return candidates;

        const inliers = [];
        for (let i = 0; i < candidates.length; i++) {
            if (hmask.data[i] === 1) inliers.push(candidates[i]);
        }
        return inliers.length >= 8 ? inliers : candidates;
    } catch (err) {
        return matches.slice(0, maxMatches);
    } finally {
        if (srcPts) srcPts.delete();
        if (dstPts) dstPts.delete();
        if (hmask) hmask.delete();
        if (hMat) hMat.delete();
    }
}

function hasEnough2DSpread(imgPoints) {
    if (imgPoints.length < 12) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < imgPoints.length; i += 2) {
        const x = imgPoints[i], y = imgPoints[i + 1];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return (maxX - minX) >= Math.max(20, trackW * 0.04)
        && (maxY - minY) >= Math.max(20, trackH * 0.04);
}

// ============================================================
// Reference Image Loading
// ============================================================

async function loadRefFromUrl() {
    // GLB mode keeps geometry in bottle.glb and reads recognition features from mark.jpg.
    // target.json is only a stale-prone precompiled cache, so runtime no longer uses it.
    await loadRefFromImage();
    updateRef3DPoints();
    self.postMessage({
        type: 'refLoaded',
        refWidth,
        refHeight,
        source: 'mark.jpg',
        levels: refLevels.map(level => ({
            scale: level.scale,
            width: level.width,
            height: level.height,
            mirrored: !!level.mirrored,
            keypointsCount: level.keypoints ? level.keypoints.size() : 0,
            originalPoints: level.originalPoints
        }))
    });
}

async function loadRefFromImage() {
    const resp = await fetch('assets/mark.jpg');
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const offscreen = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx2d = offscreen.getContext('2d');
    ctx2d.drawImage(bmp, 0, 0);
    refWidth = bmp.width;
    refHeight = bmp.height;

    const imgData = ctx2d.getImageData(0, 0, refWidth, refHeight);
    const srcMat = cv.matFromArray(refHeight, refWidth, cv.CV_8UC4, imgData.data);
    const grayMat = new cv.Mat();
    cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);

    refLevels = [];

    const buildRefLevel = (scaledGray, scale, scaledW, scaledH, mirrored) => {
        const levelKp = new cv.KeyPointVector();
        const levelDesc = new cv.Mat();
        detectAndComputeSafe(scaledGray, levelKp, levelDesc, `ref ${scale}${mirrored ? ' mirrored' : ''}`);
        const originalPoints = [];
        const matchPoints = [];
        for (let i = 0; i < levelKp.size(); i++) {
            const kp = levelKp.get(i);
            const matchX = kp.pt.x / scale;
            const matchY = kp.pt.y / scale;
            const originalX = mirrored ? Math.max(0, Math.min(refWidth, refWidth - matchX)) : matchX;
            originalPoints.push({ x: originalX, y: matchY });
            matchPoints.push({ x: matchX, y: matchY });
        }
        refLevels.push({ scale, width: scaledW, height: scaledH, mirrored, keypoints: levelKp, descriptors: levelDesc, originalPoints, matchPoints, points3D: [] });
        console.log(`[Worker] Ref scale ${scale}${mirrored ? ' mirrored' : ''}: ${levelKp.size()} kps (${scaledW}x${scaledH})`);
    };

    for (const scale of REF_LEVEL_SCALES) {
        const scaledW = Math.max(1, Math.round(refWidth * scale));
        const scaledH = Math.max(1, Math.round(refHeight * scale));
        const scaledGray = new cv.Mat();
        if (scale === 1.0) {
            grayMat.copyTo(scaledGray);
        } else {
            cv.resize(grayMat, scaledGray, new cv.Size(scaledW, scaledH), 0, 0, cv.INTER_AREA);
        }
        buildRefLevel(scaledGray, scale, scaledW, scaledH, false);
        // 前置摄像头图像是水平镜像的，需要镜像参考图层来匹配非对称特征（如文字）。
        // 主线程发送 GLB 3D 点时会对 mirrored level 翻转 UV u 坐标，确保 3D 位置正确。
        scaledGray.delete();
    }
    srcMat.delete();
    grayMat.delete();
}

// ============================================================
// 3D Point Mapping
// ============================================================

function mapRefPixelTo3D(u, v) {
    const W = refWidth, H = refHeight;
    const rTop = cfg.radiusTop;
    const rBottom = cfg.radiusBottom;

    if (cfg.usePhysicalDims && cfg.labelPhysicalWidth > 0 && cfg.labelPhysicalHeight > 0) {
        // ── Corrected mapping: horizontal arc and vertical height are independent ──
        // Horizontal: pixel u → arc position along label width
        const xArc = (u / W - 0.5) * cfg.labelPhysicalWidth;   // arc-length offset from centre
        // Vertical: pixel v → height position (top of image = top of label)
        const Y    = (0.5 - v / H) * cfg.labelPhysicalHeight;  // positive Y = up

        // Interpolate radius top→bottom (t=0 at top, t=1 at bottom)
        const t      = v / H;
        const r      = rTop * (1 - t) + rBottom * t;
        const theta  = xArc / r;                                 // arc / radius = angle (rad)
        return { X: r * Math.sin(theta), Y, Z: r * Math.cos(theta) };
    } else {
        // ── Legacy mapping (usePhysicalDims=false): kept for backward compat ──
        const height = cfg.height;
        const scale  = height / H;
        const u_centered = u - W / 2;
        const Y = (H / 2 - v) * scale;
        const t = (Y + height / 2) / height;
        const r_at_y = rBottom + (rTop - rBottom) * t;
        const theta  = (u_centered * scale) / r_at_y;
        return { X: r_at_y * Math.sin(theta), Y, Z: r_at_y * Math.cos(theta) };
    }
}

function updateRef3DPoints() {
    if (!refLevels || !refLevels.length) return;
    if (modelPointLevels && modelPointLevels.length === refLevels.length) {
        let ok = true;
        for (let i = 0; i < refLevels.length; i++) {
            const incoming = modelPointLevels[i]?.points3D;
            if (!incoming || incoming.length !== refLevels[i].originalPoints.length) {
                ok = false;
                break;
            }
        }
        if (ok) {
            for (let i = 0; i < refLevels.length; i++) {
                refLevels[i].points3D = modelPointLevels[i].points3D;
            }
            ref3DPoints = refLevels[0] ? refLevels[0].points3D : [];
            return;
        }
        console.warn('[Worker] Ignoring GLB model points: level/point counts do not match reference points');
        modelPointLevels = null;
    }
    for (const level of refLevels) {
        level.points3D = level.originalPoints.map(pt => mapRefPixelTo3D(pt.x, pt.y));
    }
    ref3DPoints = refLevels[0] ? refLevels[0].points3D : [];
}

// ============================================================
// Pure-JS Math Helpers (replaces Three.js in worker)
// ============================================================

/** Convert OpenCV rotation matrix (row-major, 9 values) to camera-world quaternion */
function rmatToQuat(rD) {
    // Camera world rotation = R'^T where R' has flipped Y,Z rows
    // R'^T rows: [rD[0],-rD[3],-rD[6]], [rD[1],-rD[4],-rD[7]], [rD[2],-rD[5],-rD[8]]
    const m00 = rD[0],  m01 = -rD[3], m02 = -rD[6];
    const m10 = rD[1],  m11 = -rD[4], m12 = -rD[7];
    const m20 = rD[2],  m21 = -rD[5], m22 = -rD[8];
    const trace = m00 + m11 + m22;
    let x, y, z, w;
    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1.0);
        w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
        const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
        w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
    } else if (m11 > m22) {
        const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
        w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
    } else {
        const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
        w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
    }
    const len = Math.sqrt(x*x + y*y + z*z + w*w);
    return { x: x/len, y: y/len, z: z/len, w: w/len };
}

function quatDot(q1, q2) { return q1.x*q2.x + q1.y*q2.y + q1.z*q2.z + q1.w*q2.w; }
function quatAngle(q1, q2) { return 2 * Math.acos(Math.min(1.0, Math.abs(quatDot(q1, q2)))); }
function vecLen(p) { return Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]); }

function readInlierIndex(mat, i) {
    if (!mat) return -1;
    if (mat.data32S && mat.data32S.length > i) return mat.data32S[i];
    if (mat.data32F && mat.data32F.length > i) return Math.round(mat.data32F[i]);
    if (mat.data && mat.data.length > i) return mat.data[i];
    try { return mat.intAt(i, 0); } catch (e) { return -1; }
}

// ============================================================
// Pose Solver — No Three.js, No 20ms Extrapolation
// ============================================================

function applySolvedPoseRaw(rvecMat, tvecMat, poseConfidenceSource, statusPrefix) {
    cv.Rodrigues(rvecMat, RMat);
    const rD = RMat.data64F;
    const tD = tvecMat.data64F;

    if (!isFinite(tD[0]) || !isFinite(tD[1]) || !isFinite(tD[2]) || tD[2] <= 0.02) {
        return { success: false, status: 'Rejected Behind/Inf' };
    }

    // Camera world position in the GLB/Three.js object frame.
    // The OpenCV -> Three.js axis flip belongs in the camera rotation matrix, not here.
    const camX = -(rD[0]*tD[0] + rD[3]*tD[1] + rD[6]*tD[2]);
    const camY = -(rD[1]*tD[0] + rD[4]*tD[1] + rD[7]*tD[2]);
    const camZ = -(rD[2]*tD[0] + rD[5]*tD[1] + rD[8]*tD[2]);
    const camPos = [camX, camY, camZ];
    const dist = vecLen(camPos);

    if (dist < 0.03 || dist > 25.0) {
        return { success: false, status: `Rejected Dist: ${dist.toFixed(2)}` };
    }

    const camQuat = rmatToQuat(rD);
    const now = performance.now();
    const hasRecentPose = !isFirstFrame && (now - lastSuccessTime < 350);

    if (hasRecentPose && lastCamPos) {
        const dx = camX - lastCamPos[0], dy = camY - lastCamPos[1], dz = camZ - lastCamPos[2];
        const positionJump = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const lastDist = vecLen(lastCamPos);
        const maxPositionJump = flowState === 'TRACKING_FLOW'
            ? Math.max(0.35, lastDist * 0.40)
            : Math.max(0.18, lastDist * 0.22);
        const maxRotationJump = flowState === 'TRACKING_FLOW' ? Math.PI / 4 : 28 * Math.PI / 180;
        const rotationJump = lastCamQuat ? quatAngle(camQuat, lastCamQuat) : 0;

        if (positionJump > maxPositionJump || rotationJump > maxRotationJump) {
            return {
                success: false,
                status: `Rejected Jump: ${positionJump.toFixed(2)} / ${(rotationJump * 180 / Math.PI).toFixed(0)}°`
            };
        }
    }

    lastCamPos = camPos;
    lastCamQuat = camQuat;
    lastSuccessTime = now;
    isFirstFrame = false;

    return {
        success: true,
        status: statusPrefix,
        confidence: Math.min(1.0, Math.max(0.25, poseConfidenceSource)),
        // 9 OpenCV rmat values for main thread to reconstruct THREE.Matrix4
        rD: Array.from(rD),
        camPos
    };
}

// ============================================================
// Reprojection Error
// ============================================================

function computeReprojectionError(objPointsMat, imgPointsMat, rvecMat, tvecMat, camMat, distMat, inliersMat) {
    let projectedMat = new cv.Mat();
    try {
        cv.projectPoints(objPointsMat, rvecMat, tvecMat, camMat, distMat, projectedMat);
        const projData = projectedMat.data32F;
        const imgData = imgPointsMat.data32F;
        let sumError = 0, count = 0;
        if (inliersMat && inliersMat.rows > 0) {
            for (let i = 0; i < inliersMat.rows; i++) {
                const idx = readInlierIndex(inliersMat, i);
                if (idx < 0 || idx >= objPointsMat.rows) continue;
                const px = projData[2*idx], py = projData[2*idx+1];
                const ix = imgData[2*idx],  iy = imgData[2*idx+1];
                if (isFinite(px) && isFinite(py)) { sumError += Math.sqrt((px-ix)**2 + (py-iy)**2); count++; }
            }
        } else {
            for (let i = 0; i < objPointsMat.rows; i++) {
                const px = projData[2*i], py = projData[2*i+1];
                const ix = imgData[2*i],  iy = imgData[2*i+1];
                if (isFinite(px) && isFinite(py)) { sumError += Math.sqrt((px-ix)**2 + (py-iy)**2); count++; }
            }
        }
        return count > 0 ? sumError / count : 999.0;
    } catch (e) { return 999.0; }
    finally { projectedMat.delete(); }
}

/**
 * Compute per-point reprojection data for overlay visualisation.
 * Returns up to maxPts {srcX,srcY,dstX,dstY,err} pairs plus zone stats.
 * W/H are the current tracking-resolution dimensions.
 */
function computeReprojectionDetails(objPointsMat, imgPointsMat, rvecMat, tvecMat, camMat, distMat, maxPts) {
    maxPts = maxPts || 60;
    const W = trackW, H = trackH;
    let projectedMat = new cv.Mat();
    try {
        cv.projectPoints(objPointsMat, rvecMat, tvecMat, camMat, distMat, projectedMat);
        const projData = projectedMat.data32F;
        const imgData  = imgPointsMat.data32F;
        const n        = objPointsMat.rows;

        const points = [];
        const allErrs = [];
        // Zone buckets  (centre = middle 1/3 × middle 1/3)
        const zErrs = { center:[], left:[], right:[], top:[], bottom:[] };

        for (let i = 0; i < n; i++) {
            const dstX = projData[2*i],   dstY = projData[2*i+1];
            const srcX = imgData[2*i],    srcY = imgData[2*i+1];
            if (!isFinite(dstX) || !isFinite(dstY)) continue;
            const err = Math.sqrt((dstX-srcX)**2 + (dstY-srcY)**2);
            allErrs.push(err);

            // Zone classification by source pixel position
            const xRatio = srcX / W, yRatio = srcY / H;
            if (xRatio < 0.33)       zErrs.left.push(err);
            else if (xRatio > 0.67)  zErrs.right.push(err);
            if (yRatio < 0.33)       zErrs.top.push(err);
            else if (yRatio > 0.67)  zErrs.bottom.push(err);
            if (xRatio >= 0.33 && xRatio <= 0.67 && yRatio >= 0.33 && yRatio <= 0.67)
                zErrs.center.push(err);

            if (points.length < maxPts) points.push({ srcX, srcY, dstX, dstY, err });
        }

        const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : -1;
        const allSorted = [...allErrs].sort((a,b)=>a-b);
        const median = allSorted.length ? allSorted[Math.floor(allSorted.length/2)] : -1;

        return {
            points,
            zoneErrors: {
                center: avg(zErrs.center),
                left:   avg(zErrs.left),
                right:  avg(zErrs.right),
                top:    avg(zErrs.top),
                bottom: avg(zErrs.bottom),
                max:    allErrs.length ? Math.max(...allErrs) : -1,
                median
            }
        };
    } catch (e) { return { points: [], zoneErrors: {} }; }
    finally { projectedMat.delete(); }
}

// ============================================================
// PnP Solve (shared by flow and ORB paths)
// ============================================================

function solvePoseFromArrays(objPointList, imgPointList, minPoints, poseConfidenceSource, statusPrefix, useExtrinsicGuess, useRansac) {
    if (objPointList.length < minPoints || imgPointList.length < minPoints) {
        return { success: false, status: `Need >= ${minPoints} pts`, method: 'None', error: 'None', inliers: 0, reprojErr: 999.0 };
    }
    let objPointsMat = null, imgPointsMat = null, pnpInliersMat = null;
    try {
        const objData = [], imgData = [];
        for (let i = 0; i < objPointList.length; i++) {
            const p3 = objPointList[i], p2 = imgPointList[i];
            if (!p3 || !p2
                || !isFiniteNumber(p3.X) || !isFiniteNumber(p3.Y) || !isFiniteNumber(p3.Z)
                || !isFiniteNumber(p2.x) || !isFiniteNumber(p2.y)) {
                continue;
            }
            objData.push(p3.X, p3.Y, p3.Z);
            imgData.push(p2.x, p2.y);
        }
        const numPts = objData.length / 3;
        if (numPts < minPoints || !hasEnough2DSpread(imgData)) {
            return { success: false, status: `Degenerate PnP (${numPts}pts)`, method: 'None', error: 'None', inliers: 0, reprojErr: 999.0 };
        }
        objPointsMat = cv.matFromArray(numPts, 3, cv.CV_32F, objData);
        imgPointsMat = cv.matFromArray(numPts, 2, cv.CV_32F, imgData);
        const pnpFlags = cv.SOLVEPNP_ITERATIVE !== undefined ? cv.SOLVEPNP_ITERATIVE : 0;
        const tStartPnp = performance.now();
        let success = false, method = 'solvePnP', pnpInlierCount = numPts;

        try {
            success = cv.solvePnP(objPointsMat, imgPointsMat, cameraMatrixMat, distCoeffsMat, rvec, tvec, useExtrinsicGuess, pnpFlags);
        } catch (pnpEx) {
            return { success: false, status: 'solvePnP failed', method: 'None', error: formatCvError(pnpEx), inliers: 0, reprojErr: 999.0 };
        }
        method = 'Flow solvePnP';
        if (success && cv.solvePnPRefineLM) {
            try {
                cv.solvePnPRefineLM(objPointsMat, imgPointsMat, cameraMatrixMat, distCoeffsMat, rvec, tvec);
                method = 'Flow solvePnP+RefineLM';
            } catch (e) {}
        }
        lastPnpTime = performance.now() - tStartPnp;

        const minPnpInliers = Math.max(8, Math.ceil(minPoints * 0.75));
        if (success && pnpInlierCount < minPnpInliers) {
            return { success: false, status: `Low Flow PnP Inliers: ${pnpInlierCount}`, method, error: 'None', inliers: pnpInlierCount, reprojErr: 999.0 };
        }
        if (!success) {
            return { success: false, status: 'Failed (Flow PnP)', method, error: 'None', inliers: pnpInlierCount, reprojErr: 999.0 };
        }

        const reprojErr = computeReprojectionError(objPointsMat, imgPointsMat, rvec, tvec, cameraMatrixMat, distCoeffsMat, pnpInliersMat);
        if (reprojErr > 8.0) {
            return { success: false, status: `Flow Reproj Err: ${reprojErr.toFixed(1)}px`, method, error: 'None', inliers: pnpInlierCount, reprojErr };
        }
        const pose = applySolvedPoseRaw(rvec, tvec, poseConfidenceSource, statusPrefix);
        // Compute per-point overlay data (light-weight, shared with main thread for visualisation)
        const reprojDetails = computeReprojectionDetails(objPointsMat, imgPointsMat, rvec, tvec, cameraMatrixMat, distCoeffsMat, 60);
        return { ...pose, method, error: 'None', inliers: pnpInlierCount, reprojErr, reprojDetails };
    } catch (err) {
        return { success: false, status: 'Flow PnP Exception', method: 'Flow PnP', error: err.message || String(err), inliers: 0, reprojErr: 999.0 };
    } finally {
        if (objPointsMat) objPointsMat.delete();
        if (imgPointsMat) imgPointsMat.delete();
        if (pnpInliersMat) pnpInliersMat.delete();
    }
}

// ============================================================
// Optical Flow Tracking
// ============================================================

function tryTrackWithOpticalFlow() {
    if (flowState !== 'TRACKING_FLOW' || flowFramePoints.length < cfg.flowMinPoints || !prevFlowGray || prevFlowGray.empty()) {
        return { success: false, status: 'Flow Not Ready', points: 0, ratio: 0, method: 'None', error: 'None', reprojErr: 999.0 };
    }
    let prevPtsMat = null, nextPtsMat = null, statusMat = null, errMat = null;
    try {
        const prevPts = [];
        for (const pt of flowFramePoints) prevPts.push(pt.x, pt.y);
        prevPtsMat = cv.matFromArray(flowFramePoints.length, 1, cv.CV_32FC2, prevPts);
        nextPtsMat = new cv.Mat();
        statusMat = new cv.Mat();
        errMat = new cv.Mat();
        const winSize = new cv.Size(15, 15);
        const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 10, 0.03);

        const tStartFlow = performance.now();
        cv.calcOpticalFlowPyrLK(prevFlowGray, frameGray, prevPtsMat, nextPtsMat, statusMat, errMat, winSize, 2, criteria);
        lastFlowTime = performance.now() - tStartFlow;

        const nextData = nextPtsMat.data32F;
        const statusData = statusMat.data;
        const nextObjPoints = [], nextFramePoints = [], nextRefPoints = [];

        for (let i = 0; i < flowFramePoints.length; i++) {
            if (statusData[i] !== 1) continue;
            const x = nextData[i * 2], y = nextData[i * 2 + 1];
            if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x >= trackW || y >= trackH) continue;
            nextObjPoints.push(flowObjPoints[i]);
            nextFramePoints.push({ x, y });
            nextRefPoints.push(flowRefPoints[i]);
        }

        const flowRatio = flowFramePoints.length > 0 ? nextFramePoints.length / flowFramePoints.length : 0;
        lastFlowRatio = flowRatio;

        if (nextFramePoints.length < cfg.flowMinPoints || flowRatio < cfg.flowMinRatio) {
            return { success: false, status: `Flow Lost: ${nextFramePoints.length}/${flowFramePoints.length}`, points: nextFramePoints.length, ratio: flowRatio, method: 'LK Flow', error: 'None', reprojErr: 999.0 };
        }

        const poseConfidence = (flowRatio * 0.65) + (Math.min(nextFramePoints.length / 40, 1) * 0.35);
        const poseResult = solvePoseFromArrays(nextObjPoints, nextFramePoints, cfg.flowMinPoints, poseConfidence, 'Success (Flow)', true, false);

        if (poseResult.success) {
            flowObjPoints = nextObjPoints;
            flowFramePoints = nextFramePoints;
            flowRefPoints = nextRefPoints;
            frameGray.copyTo(prevFlowGray);
            flowFrameCounter++;
        }
        return { ...poseResult, points: nextFramePoints.length, ratio: flowRatio, flowFramePoints: nextFramePoints, flowObjPoints: nextObjPoints };
    } finally {
        if (prevPtsMat) prevPtsMat.delete();
        if (nextPtsMat) nextPtsMat.delete();
        if (statusMat) statusMat.delete();
        if (errMat) errMat.delete();
    }
}

// ============================================================
// Feature Extraction (lazy, per-frame)
// ============================================================

function ensureFrameFeatures() {
    if (computedFrameFeatures) return;
    const tStartOrb = performance.now();
    const nextKeypoints = new cv.KeyPointVector();
    const nextDescriptors = new cv.Mat();
    try {
        detectAndComputeSafe(frameGray, nextKeypoints, nextDescriptors, 'frame');
    } catch (err) {
        nextKeypoints.delete();
        nextDescriptors.delete();
        throw err;
    }
    localFrameKeypoints = nextKeypoints;
    localFrameDescriptors = nextDescriptors;
    computedFrameFeatures = true;
    lastOrbTime += performance.now() - tStartOrb;
}

// ============================================================
// Flow State Management
// ============================================================

function resetFlowTracking(mode) {
    flowState = mode || 'SCANNING';
    flowObjPoints = []; flowFramePoints = []; flowRefPoints = [];
    flowFrameCounter = 0; lastFlowRatio = 0; scanFrameCounter = 0;
}

function seedFlowTrackingFromMatches(level, matches, localKpArray) {
    flowObjPoints = []; flowFramePoints = []; flowRefPoints = [];
    for (const m of matches) {
        const pt3D = level.points3D[m.queryIdx];
        const refPt = level.originalPoints[m.queryIdx];
        const kp = localKpArray[m.trainIdx];
        if (!pt3D || !refPt || !kp) continue;
        flowObjPoints.push({ X: pt3D.X, Y: pt3D.Y, Z: pt3D.Z });
        flowRefPoints.push({ x: refPt.x, y: refPt.y });
        flowFramePoints.push({ x: kp.pt.x, y: kp.pt.y });
    }
    if (flowFramePoints.length >= cfg.flowMinPoints) {
        frameGray.copyTo(prevFlowGray);
        flowState = 'TRACKING_FLOW';
        flowFrameCounter = 1;
        lastFlowRatio = 1.0;
    } else {
        resetFlowTracking('RELOCALIZING');
    }
}

// ============================================================
// Drift Correction
// ============================================================

function runDriftCorrection(frameKp, frameDesc) {
    const level = lastSuccessScaleLevel || refLevels[0];
    if (!level) return;
    let srcPts = null, dstPts = null, hmask = null, hH = null;
    try {
        if (!frameDesc || frameDesc.empty() || level.descriptors.empty()) return;
        const tStart = performance.now();
        const { filtered } = collectDescriptorMatches(level.descriptors, frameDesc);
        if (filtered.length >= 8) {
            const sp = [], dp = [];
            for (const m of filtered) {
                const rp = (level.matchPoints || level.originalPoints)[m.queryIdx];
                const kp = frameKp.get(m.trainIdx);
                sp.push(rp.x, rp.y); dp.push(kp.pt.x, kp.pt.y);
            }
            srcPts = cv.matFromArray(filtered.length, 1, cv.CV_32FC2, sp);
            dstPts = cv.matFromArray(filtered.length, 1, cv.CV_32FC2, dp);
            hmask = new cv.Mat();
            hH = cv.findHomography(srcPts, dstPts, cv.RANSAC, 8.0, hmask);
            const inliers = [];
            if (!hH.empty()) {
                for (let i = 0; i < filtered.length; i++) {
                    if (hmask.data[i] === 1) inliers.push(filtered[i]);
                }
            }
            if (inliers.length >= 8) {
                let upd = 0, added = 0;
                for (const m of inliers) {
                    const pt3D = level.points3D[m.queryIdx];
                    const refPt = level.originalPoints[m.queryIdx];
                    const kp = frameKp.get(m.trainIdx);
                    if (!pt3D || !refPt || !kp) continue;
                    const fx = kp.pt.x, fy = kp.pt.y;
                    let foundIdx = -1;
                    for (let j = 0; j < flowFramePoints.length; j++) {
                        const dx = flowFramePoints[j].x - fx, dy = flowFramePoints[j].y - fy;
                        if (Math.sqrt(dx*dx + dy*dy) < 3.0) { foundIdx = j; break; }
                    }
                    if (foundIdx !== -1) {
                        flowFramePoints[foundIdx] = { x: fx, y: fy };
                        flowObjPoints[foundIdx] = { X: pt3D.X, Y: pt3D.Y, Z: pt3D.Z };
                        flowRefPoints[foundIdx] = { x: refPt.x, y: refPt.y };
                        upd++;
                    } else {
                        flowFramePoints.push({ x: fx, y: fy });
                        flowObjPoints.push({ X: pt3D.X, Y: pt3D.Y, Z: pt3D.Z });
                        flowRefPoints.push({ x: refPt.x, y: refPt.y });
                        added++;
                    }
                }
                console.log(`[Worker Drift] upd=${upd} add=${added}`);
            }
        }
        lastOrbTime += performance.now() - tStart;
    } catch (err) {
        console.warn('[Worker] Drift correction failed:', err);
    } finally {
        if (srcPts) srcPts.delete(); if (dstPts) dstPts.delete();
        if (hmask) hmask.delete(); if (hH) hH.delete();
    }
}

// ============================================================
// ORB Match on a Single Scale Level
// ============================================================

function runOrbMatchOnLevel(level, frameKp, frameDesc) {
    let srcPts = null, dstPts = null, hmask = null, hH = null;
    let objPtsMat = null, imgPtsMat = null, pnpInliersMat = null;
    const result = {
        success: false,
        status: 'No Match',
        method: 'None',
        error: 'None',
        inliers: 0,
        rawMatches: 0,
        filteredMatches: 0,
        goodMatches: 0,
        inlierRatio: 0,
        confidence: 1.0,
        reprojErr: 999.0,
        reprojDetails: { points: [], zoneErrors: {} },
        inlierMatches: [],
        localFrameKeypoints: null,
        frameKpCount: 0
    };
    try {
        result.frameKpCount = frameKp ? frameKp.size() : 0;
        if (!frameDesc || frameDesc.empty() || level.descriptors.empty()) { result.status = 'Empty Descriptors'; return result; }

        const tStartMatch = performance.now();
        const matchInfo = collectDescriptorMatches(level.descriptors, frameDesc);
        const filtered = matchInfo.filtered;
        const rawCount = matchInfo.rawCount;
        result.rawMatches = rawCount;
        result.filteredMatches = filtered.length;
        lastOrbTime += performance.now() - tStartMatch;

        const dynamicMin = level.scale <= 0.5 ? Math.min(Math.round(cfg.minMatches), 10) : Math.round(cfg.minMatches);

        if (filtered.length >= dynamicMin) {
            filtered.sort((a, b) => a.distance - b.distance);
            const topMatches = filtered.slice(0, 160);
            const homographyMatches = filterMatchesByHomography(level, frameKp, topMatches, 120);
            const pnpData = buildPnPCorrespondences(level, frameKp, homographyMatches, 100);
            const objPoints = pnpData.objPoints;
            const imgPoints = pnpData.imgPoints;
            const numPts = pnpData.numPts;
            // DLT 需要至少 6 个点，且不少于动态最小值；低于 6 点会抛出 OpenCV 异常
            const minPnpInliers = Math.max(14, Math.round(dynamicMin));
            if (numPts >= Math.max(6, minPnpInliers)) {
                if (!hasEnough2DSpread(imgPoints)) {
                    result.status = `Degenerate PnP spread (${numPts}pts)`;
                    return result;
                }
                objPtsMat = cv.matFromArray(numPts, 3, cv.CV_32F, objPoints);
                imgPtsMat = cv.matFromArray(numPts, 2, cv.CV_32F, imgPoints);
                const pnpFlags = cv.SOLVEPNP_ITERATIVE !== undefined ? cv.SOLVEPNP_ITERATIVE : 0;
                const tStartPnp = performance.now();
                // 内层 try-catch：OpenCV 内部去重后有效点可能 < 6，导致 DLT 异常
                // 此时静默失败（不是真正的错误，只是当前帧匹配点退化）
                let success = false;
                try {
                    success = cv.solvePnP(objPtsMat, imgPtsMat, cameraMatrixMat, distCoeffsMat, rvec, tvec, false, pnpFlags);
                    if (success && cv.solvePnPRefineLM) {
                        try {
                            cv.solvePnPRefineLM(objPtsMat, imgPtsMat, cameraMatrixMat, distCoeffsMat, rvec, tvec);
                        } catch (refineErr) {}
                    }
                } catch (pnpEx) {
                    result.status = `PnP退化(${numPts}pts)`;
                    lastPnpTime += performance.now() - tStartPnp;
                    return result;  // 直接返回，跳过后续处理
                }
                lastPnpTime += performance.now() - tStartPnp;
                const pnpInlierCount = numPts;
                result.inliers = pnpInlierCount;
                result.method = `Homography+PnP (${pnpInlierCount})`;
                result.goodMatches = pnpInlierCount;
                result.inlierRatio = topMatches.length > 0 ? homographyMatches.length / topMatches.length : 0;

                if (success && pnpInlierCount >= minPnpInliers) {
                    const error = computeReprojectionError(objPtsMat, imgPtsMat, rvec, tvec, cameraMatrixMat, distCoeffsMat, null);
                    result.reprojErr = error;
                    if (error <= 8.0) {
                        const confidence = (result.inlierRatio * 0.55) + (Math.min(numPts / (dynamicMin * 2), 1) * 0.45);
                        const pose = applySolvedPoseRaw(rvec, tvec, confidence, 'Success (PnP)');
                        if (pose.success) {
                            // 记录重投影点与分区误差，便于主线程做可视化诊断。
                            result.reprojDetails = computeReprojectionDetails(objPtsMat, imgPtsMat, rvec, tvec, cameraMatrixMat, distCoeffsMat, 60);
                            result.success = true;
                            result.status = 'Success';
                            result.confidence = pose.confidence;
                            result.rD = pose.rD;
                            result.camPos = pose.camPos;
                            result.inlierMatches = homographyMatches.slice(0, pnpInlierCount);
                            result.localFrameKeypoints = [];
                            for (let i = 0; i < frameKp.size(); i++) {
                                const kp = frameKp.get(i);
                                result.localFrameKeypoints.push({ pt: { x: kp.pt.x, y: kp.pt.y } });
                            }
                        } else { result.status = pose.status; }
                    } else { result.status = `High Reproj: ${error.toFixed(1)}px`; }
                } else { result.status = success ? `Low Inliers: ${pnpInlierCount}` : 'PnP Failed'; }
            } else { result.status = `Need >= ${Math.max(6, dynamicMin)} pts, got ${numPts}`; }
        } else { result.status = `Low descriptor matches: ${filtered.length}/${dynamicMin}`; }
    } catch (err) {
        result.error = formatCvError(err);
        result.status = 'Exception';
        console.error('[Worker] runOrbMatchOnLevel error:', result.error, err);
    } finally {
        if (srcPts) srcPts.delete(); if (dstPts) dstPts.delete();
        if (hmask) hmask.delete(); if (hH) hH.delete();
        if (objPtsMat) objPtsMat.delete(); if (imgPtsMat) imgPtsMat.delete();
        if (pnpInliersMat) pnpInliersMat.delete();
    }
    return result;
}

// ============================================================
// Full Multi-Scale Scan
// ============================================================

function runFullScaleScan(frameKp, frameDesc) {
    let bestResult = null, bestLevel = null;
    for (const level of refLevels) {
        const res = runOrbMatchOnLevel(level, frameKp, frameDesc);
        const levelText = `${level.scale.toFixed(2)}x${level.mirrored ? ' mirrored' : ''}`;
        if (res.success) return { ...res, level, bestScaleText: levelText };
        if (!bestResult
            || res.goodMatches > bestResult.goodMatches
            || (res.goodMatches === bestResult.goodMatches && res.filteredMatches > (bestResult.filteredMatches || 0))) {
            bestResult = res;
            bestLevel = level;
        }
    }
    if (bestResult) return { ...bestResult, level: bestLevel, bestScaleText: bestLevel ? `${bestLevel.scale.toFixed(2)}x${bestLevel.mirrored ? ' mirrored' : ''}` : '-' };
    return { success: false, status: 'Scanning...', method: 'None', error: 'None', inliers: 0, rawMatches: 0, filteredMatches: 0, goodMatches: 0, inlierRatio: 0, confidence: 0, reprojErr: 999.0, bestScaleText: '-', level: null };
}

// ============================================================
// Main Frame Processing — called when a 'frame' message arrives
// ============================================================

function processFrameInWorker(pixels, frameStartTime, rvfcMeta, frameWidth, frameHeight) {
    configureFrameSize(frameWidth, frameHeight);
    // Decode pixel data into cv.Mat and convert to grayscale
    const tStartGray = performance.now();
    const pixelData = new Uint8ClampedArray(pixels);
    if (pixelData.length !== trackW * trackH * 4) {
        throw new Error(`Frame buffer size mismatch: got ${pixelData.length}, expected ${trackW * trackH * 4}`);
    }
    frameMat.data.set(pixelData);
    cv.cvtColor(frameMat, frameGray, cv.COLOR_RGBA2GRAY);
    lastGrayTime = performance.now() - tStartGray;

    lastFlowTime = 0; lastOrbTime = 0; lastPnpTime = 0;
    computedFrameFeatures = false;
    if (localFrameKeypoints) { try { localFrameKeypoints.delete(); } catch(e){} localFrameKeypoints = null; }
    if (localFrameDescriptors) { try { localFrameDescriptors.delete(); } catch(e){} localFrameDescriptors = null; }

    let trackingSuccess = false;
    let pnpStatus = 'Idle', pnpMethod = 'None', pnpError = 'None';
    let bestScaleText = '-', dynamicMinMatches = Math.round(cfg.minMatches);
    let bestInlierRatio = 0, pnpInlierCount = 0, poseConfidence = 1.0;
    let reprojErrVal = 0;
    let goodMatchesCount = 0;
    let rawMatchesCount = 0;
    let filteredMatchesCount = 0;
    let poseCamPos = null, poseRD = null;
    let frameKpCount = 0;
    let reprojPoints = [], zoneErrors = {};

    try {
        // ── TRACKING_FLOW ──────────────────────────────────────────
        if (flowState === 'TRACKING_FLOW') {
            const flowResult = tryTrackWithOpticalFlow();
            pnpStatus = flowResult.status; pnpMethod = flowResult.method;
            pnpError = flowResult.error; pnpInlierCount = flowResult.inliers || 0;

            if (flowResult.success) {
                trackingSuccess = true;
                goodMatchesCount = flowResult.points;
                bestInlierRatio = flowResult.ratio;
                bestScaleText = 'flow';
                poseConfidence = flowResult.confidence || 1.0;
                reprojErrVal = flowResult.reprojErr || 0;
                dynamicMinMatches = cfg.flowMinPoints;
                poseCamPos = flowResult.camPos;
                poseRD = flowResult.rD;
                reprojPoints = flowResult.reprojDetails?.points || [];
                zoneErrors = flowResult.reprojDetails?.zoneErrors || {};

                // Conditional drift correction (only when drifting or at safety interval)
                const reprojDrifting = reprojErrVal > 3.8;
                const driftInterval = Math.max(cfg.orbRelocalizeInterval * 2, 24);
                const safetyInterval = Math.max(cfg.orbRelocalizeInterval * 10, 120);
                const shouldCorrect = (reprojDrifting && flowFrameCounter % driftInterval === 0)
                    || (flowFrameCounter % safetyInterval === 0);
                if (shouldCorrect) {
                    ensureFrameFeatures();
                    runDriftCorrection(localFrameKeypoints, localFrameDescriptors);
                }
            } else {
                flowState = 'RELOCALIZING';
            }
        }

        // ── RELOCALIZING ───────────────────────────────────────────
        if (flowState === 'RELOCALIZING') {
            const level = lastSuccessScaleLevel || refLevels[0];
            if (level) {
                ensureFrameFeatures();
                const matchResult = runOrbMatchOnLevel(level, localFrameKeypoints, localFrameDescriptors);
                pnpStatus = matchResult.status; pnpMethod = matchResult.method;
                pnpError = matchResult.error; pnpInlierCount = matchResult.inliers || 0;
                goodMatchesCount = matchResult.goodMatches;
                rawMatchesCount = matchResult.rawMatches || 0;
                filteredMatchesCount = matchResult.filteredMatches || 0;
                bestInlierRatio = matchResult.inlierRatio;
                bestScaleText = `${level.scale.toFixed(2)}x (Reloc)`;
                frameKpCount = matchResult.frameKpCount || 0;

                if (matchResult.success) {
                    flowState = 'TRACKING_FLOW';
                    trackingSuccess = true;
                    poseConfidence = matchResult.confidence;
                    reprojErrVal = matchResult.reprojErr;
                    poseCamPos = matchResult.camPos;
                    poseRD = matchResult.rD;
                    reprojPoints = matchResult.reprojDetails?.points || [];
                    zoneErrors = matchResult.reprojDetails?.zoneErrors || {};
                    seedFlowTrackingFromMatches(level, matchResult.inlierMatches, matchResult.localFrameKeypoints);
                } else {
                    const timeSinceLast = performance.now() - lastSuccessTime;
                    const persistence = Number(cfg.relocalizePersistence) || 1500;
                    if (timeSinceLast < persistence) {
                        trackingSuccess = true;
                        pnpStatus = `Relocating (Persistence: ${Math.round(persistence - timeSinceLast)}ms)`;
                    } else {
                        flowState = 'LOST';
                        resetFlowTracking('LOST');
                    }
                }
            } else {
                flowState = 'LOST';
                resetFlowTracking('LOST');
            }
        }

        // ── LOST ───────────────────────────────────────────────────
        if (flowState === 'LOST') {
            scanFrameCounter++;
            if (scanFrameCounter % 5 !== 1) {
                pnpStatus = 'Lost (Throttled)'; bestScaleText = '-';
            } else {
                ensureFrameFeatures();
                const scanResult = runFullScaleScan(localFrameKeypoints, localFrameDescriptors);
                pnpStatus = scanResult.status; pnpMethod = scanResult.method;
                pnpError = scanResult.error; pnpInlierCount = scanResult.inliers || 0;
                goodMatchesCount = scanResult.goodMatches;
                rawMatchesCount = scanResult.rawMatches || 0;
                filteredMatchesCount = scanResult.filteredMatches || 0;
                bestInlierRatio = scanResult.inlierRatio;
                bestScaleText = scanResult.bestScaleText;
                frameKpCount = scanResult.frameKpCount || 0;
                if (scanResult.success) {
                    flowState = 'TRACKING_FLOW'; trackingSuccess = true;
                    poseConfidence = scanResult.confidence; reprojErrVal = scanResult.reprojErr;
                    poseCamPos = scanResult.camPos; poseRD = scanResult.rD;
                    reprojPoints = scanResult.reprojDetails?.points || [];
                    zoneErrors = scanResult.reprojDetails?.zoneErrors || {};
                    lastSuccessScaleLevel = scanResult.level;
                    seedFlowTrackingFromMatches(scanResult.level, scanResult.inlierMatches, scanResult.localFrameKeypoints);
                }
            }
        }

        // ── SCANNING ───────────────────────────────────────────────
        if (flowState === 'SCANNING') {
            scanFrameCounter++;
            if (scanFrameCounter % 5 !== 1) {
                pnpStatus = 'Scanning (Throttled)'; bestScaleText = '-';
            } else {
                ensureFrameFeatures();
                const scanResult = runFullScaleScan(localFrameKeypoints, localFrameDescriptors);
                pnpStatus = scanResult.status; pnpMethod = scanResult.method;
                pnpError = scanResult.error; pnpInlierCount = scanResult.inliers || 0;
                goodMatchesCount = scanResult.goodMatches;
                rawMatchesCount = scanResult.rawMatches || 0;
                filteredMatchesCount = scanResult.filteredMatches || 0;
                bestInlierRatio = scanResult.inlierRatio;
                bestScaleText = scanResult.bestScaleText;
                frameKpCount = scanResult.frameKpCount || 0;
                if (scanResult.success) {
                    flowState = 'TRACKING_FLOW'; trackingSuccess = true;
                    poseConfidence = scanResult.confidence; reprojErrVal = scanResult.reprojErr;
                    poseCamPos = scanResult.camPos; poseRD = scanResult.rD;
                    reprojPoints = scanResult.reprojDetails?.points || [];
                    zoneErrors = scanResult.reprojDetails?.zoneErrors || {};
                    lastSuccessScaleLevel = scanResult.level;
                    seedFlowTrackingFromMatches(scanResult.level, scanResult.inlierMatches, scanResult.localFrameKeypoints);
                }
            }
        }

    } catch (err) {
        pnpError = formatCvError(err);
        pnpStatus = 'Loop Exception';
        console.error('[Worker] processFrame error:', pnpError, err);
    } finally {
        if (localFrameKeypoints) { try { localFrameKeypoints.delete(); } catch(e){} localFrameKeypoints = null; }
        if (localFrameDescriptors) { try { localFrameDescriptors.delete(); } catch(e){} localFrameDescriptors = null; }
    }

    // Compute frameLatencyMs at solve time for accurate measurement
    const frameLatencyMs = rvfcMeta && rvfcMeta.expectedDisplayTime
        ? performance.now() - rvfcMeta.expectedDisplayTime
        : null;

    self.postMessage({
        type: 'poseResult',
        trackingSuccess,
        goodMatchesCount,
        rawMatchesCount,
        filteredMatchesCount,
        bestScaleText,
        dynamicMinMatches,
        bestInlierRatio,
        reprojErrVal,
        pnpStatus,
        pnpMethod,
        pnpError,
        pnpInlierCount,
        poseConfidence,
        reprojPoints,
        zoneErrors,
        frameStartTime,
        flowState,
        flowFramePointsLen: flowFramePoints.length,
        flowRatio: lastFlowRatio,
        lastGrayTime,
        lastFlowTime,
        lastOrbTime,
        lastPnpTime,
        frameKpCount,
        trackingWidth: trackW,
        trackingHeight: trackH,
        camPos: poseCamPos,
        rD: poseRD,
        rvfcMeta,
        frameLatencyMs,
        presentedFrames: rvfcMeta ? rvfcMeta.presentedFrames : null
    });
}


// ============================================================
// Message Handler (with pre-ready queue)
// ============================================================

function handleMessage(e) {
    const { type } = e.data;
    switch (type) {
        case 'loadRef':
            loadRefFromUrl().catch(err => {
                console.error('[Worker] loadRef failed:', err);
                self.postMessage({ type: 'error', message: err.message });
            });
            break;
        case 'frame':
            try {
                processFrameInWorker(e.data.pixels, e.data.frameStartTime, e.data.rvfcMeta, e.data.frameWidth, e.data.frameHeight);
            } catch (err) {
                const message = formatCvError(err);
                console.error('[Worker] frame message error:', message, err);
                self.postMessage({ type: 'error', message });
            }
            break;
        case 'updateConfig':
            Object.assign(cfg, e.data.config);
            // If orbMaxFeatures changed, reinit ORB
            if (e.data.reinitOrb) initTracker();
            // Camera matrix changes on fovScale update
            initCameraMatrix();
            // 3D points change on geometry config update
            if (e.data.reinit3DPoints) updateRef3DPoints();
            break;
        case 'modelPoints':
            modelPointLevels = Array.isArray(e.data.levels) ? e.data.levels : null;
            updateRef3DPoints();
            resetFlowTracking('SCANNING');
            self.postMessage({ type: 'modelPointsApplied', levels: modelPointLevels ? modelPointLevels.length : 0 });
            break;
        case 'reset':
            resetFlowTracking('SCANNING');
            isFirstFrame = true;
            lastCamPos = null;
            lastCamQuat = null;
            break;
    }
}

self.onmessage = function (e) {
    if (!cvIsReady) {
        // Buffer messages until OpenCV is ready
        pendingMessages.push(e);
        return;
    }
    handleMessage(e);
};

// Flush pending messages after cv init — handled in Module.onRuntimeInitialized above
