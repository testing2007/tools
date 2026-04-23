(function attachRouteMotion(global) {
    'use strict';

    const EASING_PRESETS = Object.freeze({
        linear: [0, 0, 1, 1],
        ease: [0.25, 0.1, 0.25, 1],
        easeIn: [0.42, 0, 1, 1],
        easeOut: [0, 0, 0.58, 1],
        easeInOut: [0.42, 0, 0.58, 1]
    });

    /**
     * 基础钳制函数，避免坐标或参数越界。
     */
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function lerp(start, end, progress) {
        return start + ((end - start) * progress);
    }

    /**
     * 返回预设 easing 对应的 cubic-bezier 控制点。
     */
    function getPresetBezier(name) {
        const preset = EASING_PRESETS[name] || EASING_PRESETS.easeInOut;
        return {
            x1: preset[0],
            y1: preset[1],
            x2: preset[2],
            y2: preset[3]
        };
    }

    /**
     * 规范化贝塞尔控制点，顺便把数值限制到 0~1。
     */
    function normalizeBezier(bezier) {
        const source = bezier || getPresetBezier('easeInOut');
        return {
            x1: clamp(Number(source.x1), 0, 1),
            y1: clamp(Number(source.y1), 0, 1),
            x2: clamp(Number(source.x2), 0, 1),
            y2: clamp(Number(source.y2), 0, 1)
        };
    }

    /**
     * 构建右侧预览区的安全可视矩形。
     */
    function buildSafeViewportRect(viewportWidth, viewportHeight, ratio) {
        const safeWidth = viewportWidth * ratio;
        const safeHeight = viewportHeight * ratio;

        return {
            x: (viewportWidth - safeWidth) / 2,
            y: (viewportHeight - safeHeight) / 2,
            width: safeWidth,
            height: safeHeight
        };
    }

    /**
     * 把 0~1 的关键帧锚点映射成真实像素坐标。
     */
    function normalizePointsIntoRect(points, rect) {
        return points.map((point) => ({
            x: rect.x + (rect.width * point.x),
            y: rect.y + (rect.height * point.y)
        }));
    }

    /**
     * 把任意指针位置反投影回安全区内部的归一化坐标。
     */
    function projectPointIntoRect(x, y, rect) {
        return {
            x: clamp((x - rect.x) / rect.width, 0, 1),
            y: clamp((y - rect.y) / rect.height, 0, 1)
        };
    }

    function pathToSvgString(points) {
        return points.map((point) => `${point.x},${point.y}`).join(' ');
    }

    /**
     * 把闭合关键帧路径拆成可采样的线段数据。
     * 每段都记录长度和累计距离，便于后续按“路径距离”采样。
     */
    function buildClosedPathSegments(points) {
        if (!points.length) {
            return { segments: [], totalLength: 0 };
        }

        const segments = [];
        let totalLength = 0;

        for (let index = 0; index < points.length; index += 1) {
            const start = points[index];
            const end = points[(index + 1) % points.length];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy);

            segments.push({
                index,
                start,
                end,
                length,
                startOffset: totalLength
            });

            totalLength += length;
        }

        return { segments, totalLength };
    }

    /**
     * 按路径总距离的归一化进度采样。
     * progress = 0.25 表示整条闭合路径 25% 的位置。
     */
    function samplePathData(pathData, progress) {
        if (!pathData || !pathData.segments.length || pathData.totalLength <= 0) {
            return { x: 0, y: 0, segmentIndex: 0, localProgress: 0 };
        }

        const normalizedProgress = ((progress % 1) + 1) % 1;
        const targetDistance = normalizedProgress * pathData.totalLength;

        for (let index = 0; index < pathData.segments.length; index += 1) {
            const segment = pathData.segments[index];
            const segmentEnd = segment.startOffset + segment.length;

            if (targetDistance <= segmentEnd || index === pathData.segments.length - 1) {
                const localDistance = targetDistance - segment.startOffset;
                const localProgress = segment.length === 0 ? 0 : localDistance / segment.length;

                return {
                    x: lerp(segment.start.x, segment.end.x, localProgress),
                    y: lerp(segment.start.y, segment.end.y, localProgress),
                    segmentIndex: segment.index,
                    localProgress
                };
            }
        }

        const fallback = pathData.segments[pathData.segments.length - 1];
        return {
            x: fallback.end.x,
            y: fallback.end.y,
            segmentIndex: fallback.index,
            localProgress: 1
        };
    }

    function sampleClosedPath(points, progress) {
        return samplePathData(buildClosedPathSegments(points), progress);
    }

    function cubicBezierValue(a, b, c, d, progress) {
        const t = clamp(progress, 0, 1);
        const mt = 1 - t;
        return (mt * mt * mt * a)
            + (3 * mt * mt * t * b)
            + (3 * mt * t * t * c)
            + (t * t * t * d);
    }

    function cubicBezierDerivative(a, b, c, d, progress) {
        const t = clamp(progress, 0, 1);
        const mt = 1 - t;
        return (3 * mt * mt * (b - a))
            + (6 * mt * t * (c - b))
            + (3 * t * t * (d - c));
    }

    /**
     * 因为 easing 以 x 作为时间轴，所以需要先反解 x 对应的 t，再求 y。
     */
    function solveBezierTForX(targetX, x1, x2) {
        let t = clamp(targetX, 0, 1);

        for (let index = 0; index < 6; index += 1) {
            const x = cubicBezierValue(0, x1, x2, 1, t);
            const dx = cubicBezierDerivative(0, x1, x2, 1, t);

            if (Math.abs(x - targetX) < 0.0001) {
                return t;
            }

            if (Math.abs(dx) < 0.000001) {
                break;
            }

            t = clamp(t - ((x - targetX) / dx), 0, 1);
        }

        let low = 0;
        let high = 1;

        for (let index = 0; index < 18; index += 1) {
            t = (low + high) / 2;
            const x = cubicBezierValue(0, x1, x2, 1, t);

            if (x < targetX) {
                low = t;
            } else {
                high = t;
            }
        }

        return t;
    }

    function evaluateBezierEase(bezier, progress) {
        const curve = normalizeBezier(bezier);
        const targetX = clamp(progress, 0, 1);
        const t = solveBezierTForX(targetX, curve.x1, curve.x2);
        return cubicBezierValue(0, curve.y1, curve.y2, 1, t);
    }

    function getBezierPoint(bezier, progress) {
        const curve = normalizeBezier(bezier);
        return {
            x: cubicBezierValue(0, curve.x1, curve.x2, 1, progress),
            y: cubicBezierValue(0, curve.y1, curve.y2, 1, progress)
        };
    }

    /**
     * 根据关键帧段落配置，求出当前时间在整条闭合路径上的全局进度。
     * cycleMs > 0 时会把所有段落时长按比例缩放到这个总周期；
     * cycleMs = 0 时，不强制总周期，直接按各段原始时长无限循环。
     */
    function resolveTimelineProgress(pathData, segmentSettings, timeMs, cycleMs, phaseOffset) {
        if (!pathData || !pathData.segments.length || pathData.totalLength <= 0) {
            return {
                progress: 0,
                segmentIndex: 0,
                localProgress: 0,
                easedProgress: 0,
                totalDuration: 0
            };
        }

        const settings = pathData.segments.map((pathSegment, index) => {
            const config = segmentSettings[index] || {};
            return {
                index,
                duration: Math.max(1, Number(config.duration) || 1000),
                bezier: normalizeBezier(config.bezier || getPresetBezier(config.easingPreset)),
                length: pathSegment.length,
                startOffset: pathSegment.startOffset
            };
        });

        const naturalTotal = settings.reduce((sum, item) => sum + item.duration, 0) || 1;
        const totalDuration = cycleMs > 0 ? cycleMs : naturalTotal;
        const durationScale = totalDuration / naturalTotal;
        const offsetMs = clamp(Number(phaseOffset) || 0, 0, 1) * totalDuration;
        const loopedTime = ((timeMs + offsetMs) % totalDuration + totalDuration) % totalDuration;

        let cursor = 0;

        for (let index = 0; index < settings.length; index += 1) {
            const setting = settings[index];
            const adjustedDuration = setting.duration * durationScale;
            const segmentEndTime = cursor + adjustedDuration;

            if (loopedTime <= segmentEndTime || index === settings.length - 1) {
                const localTime = loopedTime - cursor;
                const localProgress = adjustedDuration <= 0 ? 0 : clamp(localTime / adjustedDuration, 0, 1);
                const easedProgress = evaluateBezierEase(setting.bezier, localProgress);
                const globalDistance = setting.startOffset + (setting.length * easedProgress);

                return {
                    progress: pathData.totalLength === 0 ? 0 : (globalDistance / pathData.totalLength),
                    segmentIndex: setting.index,
                    localProgress,
                    easedProgress,
                    totalDuration
                };
            }

            cursor = segmentEndTime;
        }

        return {
            progress: 0,
            segmentIndex: 0,
            localProgress: 0,
            easedProgress: 0,
            totalDuration
        };
    }

    /**
     * 限制圆心位置，允许圆部分越界，但不允许整颗圆完全消失。
     */
    function constrainCircleCenter(x, y, radius, viewportWidth, viewportHeight, overflowRatio) {
        const overflow = radius * overflowRatio;
        return {
            x: clamp(x, -overflow, viewportWidth + overflow),
            y: clamp(y, -overflow, viewportHeight + overflow)
        };
    }

    global.RouteMotion = {
        EASING_PRESETS,
        clamp,
        normalizeBezier,
        getPresetBezier,
        buildSafeViewportRect,
        normalizePointsIntoRect,
        projectPointIntoRect,
        pathToSvgString,
        buildClosedPathSegments,
        samplePathData,
        sampleClosedPath,
        evaluateBezierEase,
        getBezierPoint,
        resolveTimelineProgress,
        constrainCircleCenter
    };
}(window));
