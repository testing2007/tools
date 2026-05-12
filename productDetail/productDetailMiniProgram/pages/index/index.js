const PRODUCT_CONFIG = require('../../data/productConfig');

const DEFAULT_TRANSITION = {
  mode: 'snap',
  threshold: 96,
  velocityThreshold: 0.45,
  resistance: 0.26,
  flowStart: 0.55,
  springEase: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
  switchEase: 'transform 0.48s cubic-bezier(0.22,1,0.36,1)'
};

const EASE_NONE = 'none';
const DEFAULT_STYLE = {
  color: '#111',
  fontSize: 28,
  fontWeight: '700',
  bgColor: 'rgba(255,255,255,0.9)',
  bgBlur: true,
  boxShadow: true
};

// 小程序运行环境不一定提供 requestAnimationFrame，这里做一层兼容封装。
// 回调继续传入时间戳，保证后续缓动/惯性算法不需要区分运行环境。
const requestFrame = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame.bind(globalThis)
  : (callback) => setTimeout(() => callback(Date.now()), 16);

const cancelFrame = typeof cancelAnimationFrame === 'function'
  ? cancelAnimationFrame.bind(globalThis)
  : (timerId) => clearTimeout(timerId);

const DEBUG_STAGE_TEXT = {
  idle: '空闲：当前没有手势，页面停在某个稳定状态',
  touchStart: '触摸开始：记录起点，后续所有位移都基于这些基线计算',
  innerScroll: '组内滚动：手势还在当前分组内容范围内，只修改 groupY',
  overscroll: '越界蓄力：已经顶到边界，开始累计 progress，等待触发切组',
  flowPan: 'flow 续拖：当前卡在两个分组之间，手势直接拖动 outerY',
  snapBack: '回弹：越界不足以切组，outerY 回到当前分组基线',
  fling: '惯性滚动：手指离开后，groupY 按速度和摩擦继续滑行',
  switchGroup: '切组动画：满足阈值或速度条件，outerY 正在切到目标分组',
  entrance: '入场动画：当前分组第一次进入视口中心，overlay 执行首播动画'
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function formatDebugNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '--';
}

function normalizePercent(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num <= 1 ? num * 100 : num;
}

function normalizePoint(point = {}, fallback = {}) {
  return {
    x: normalizePercent(point.x, fallback.x ?? 50),
    y: normalizePercent(point.y, fallback.y ?? 50)
  };
}

function normalizeMotionPoint(point = {}, fallback = {}) {
  return {
    x: Number.isFinite(point.x) ? point.x : (fallback.x ?? 0),
    y: Number.isFinite(point.y) ? point.y : (fallback.y ?? 0),
    unit: point.unit || fallback.unit || 'rpx'
  };
}

function getDefaultMotion(type) {
  switch (type) {
    case 'slideX_left':
      return { x: 60, y: 0, unit: 'rpx' };
    case 'slideX_right':
      return { x: -60, y: 0, unit: 'rpx' };
    case 'slideY':
      return { x: 0, y: 60, unit: 'rpx' };
    default:
      return { x: 0, y: 0, unit: 'rpx' };
  }
}

Page({
  data: {
    groups: [],
    outerY: 0,
    outerEase: EASE_NONE,
    groupY: [],
    currentGroup: 0,
    springProg: 0,
    springDir: 'next',
    debugCollapsed: false,
    debugInfo: {
      stage: 'idle',
      stageText: DEBUG_STAGE_TEXT.idle,
      activeGroup: 0,
      currentGroup: 0,
      activeImage: 0,
      activeImageProgress: '0.00',
      activeImageTop: '0.00',
      outerY: '0.00',
      groupY: '0.00',
      currentGroupY: '0.00',
      maxGroupScroll: '0.00',
      velocity: '0.00',
      mode: DEFAULT_TRANSITION.mode,
      direction: 'none',
      overscroll: '0.00',
      progress: '0.00',
      canSwitch: '否',
      flowPan: '否',
      outerPage: '0.00',
      threshold: String(DEFAULT_TRANSITION.threshold),
      velocityThreshold: String(DEFAULT_TRANSITION.velocityThreshold),
      hint: 'outerY 控制分组切换，groupY 控制当前分组内部滚动'
    }
  },

  _wH: 0,
  _groupMaxScroll: [],
  _activeGidx: 0,
  _touchStartY: 0,
  _touchStartTime: 0,
  _touchStartGroupY: 0,
  _touchStartOuterY: 0,
  _touchLastY: 0,
  _touchLastTime: 0,
  _lastVelocity: 0,
  _rafId: null,
  _outerEaseTimer: null,
  _layoutMeasureTimer: null,
  _transitionConfig: DEFAULT_TRANSITION,
  _overscrollState: null,
  _flowPanState: null,
  _enterTimer: null,
  _enteredGroups: [],

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this._wH = sys.windowHeight;
    this._transitionConfig = {
      ...DEFAULT_TRANSITION,
      ...(PRODUCT_CONFIG.groupTransition || {})
    };

    // 运行期滚动会高频执行，这里提前把配置标准化，后面动画计算只做纯数值运算。
    const groups = (PRODUCT_CONFIG.groups || []).map((group, gidx) => ({
      ...group,
      images: (group.images || []).map((img, imgIndex) => ({
        ...img,
        overlays: (img.overlays || []).map((ov, ovIndex) => this._normalizeOverlay(ov, gidx, imgIndex, ovIndex))
      }))
    }));

    this._groupMaxScroll = new Array(groups.length).fill(0);
    this._enteredGroups = new Array(groups.length).fill(false);

    this.setData({
      groups,
      groupY: new Array(groups.length).fill(0),
      currentGroup: 0,
      debugInfo: this._buildDebugInfo({ stage: 'idle' })
    }, () => {
      setTimeout(() => {
        this._measureLayout();
        this._refreshVisibleState(0, 0);
        this._ensureGroupEntrance(0, this.data.outerY);
      }, 120);
    });
  },

  onUnload() {
    this._stopAnimations();
  },

  _stopAnimations() {
    if (this._rafId) {
      cancelFrame(this._rafId);
      this._rafId = null;
    }
    if (this._outerEaseTimer) {
      clearTimeout(this._outerEaseTimer);
      this._outerEaseTimer = null;
    }
    if (this._layoutMeasureTimer) {
      clearTimeout(this._layoutMeasureTimer);
      this._layoutMeasureTimer = null;
    }
    if (this._enterTimer) {
      clearTimeout(this._enterTimer);
      this._enterTimer = null;
    }
  },

  _normalizeOverlay(ov, gidx, imgIndex, ovIndex) {
    // overlay 最终锚点统一转成百分比，便于素材尺寸变化后依然保持相对定位。
    const pos = normalizePoint(ov.pos, { x: 8, y: 40 });
    const anim = { ...(ov.anim || {}) };
    const defaultMotion = getDefaultMotion(anim.type);
    const from = normalizeMotionPoint(anim.from, defaultMotion);
    const to = normalizeMotionPoint(anim.to, { x: 0, y: 0, unit: from.unit });

    anim.type = anim.type || 'fade';
    anim.startPos = anim.startPos ?? 0;
    anim.endPos = anim.endPos ?? 0.65;
    if (anim.endPos <= anim.startPos) {
      anim.endPos = anim.startPos + 0.01;
    }
    anim.from = from;
    anim.to = to;
    anim.fromScale = anim.fromScale ?? (anim.type === 'zoom' ? 0.82 : 1);
    anim.toScale = anim.toScale ?? 1;
    anim.fromOpacity = anim.fromOpacity ?? 0;
    anim.toOpacity = anim.toOpacity ?? 1;

    return {
      ...ov,
      pos,
      anim,
      style: {
        ...DEFAULT_STYLE,
        ...(ov.style || {})
      },
      _anchorStyle: `left:${pos.x}%; top:${pos.y}%;`,
      _dynamicStyle: this._buildOverlayStyle({
        anim,
        progress: 0,
        transitionStyle: 'transition: none;'
      })
    };
  },

  _measureLayout() {
    const q = this.createSelectorQuery();
    this.data.groups.forEach((_, i) => q.select(`#gc-${i}`).boundingClientRect());
    q.exec((rects) => {
      if (!rects || rects.some((r) => !r)) {
        setTimeout(() => this._measureLayout(), 220);
        return;
      }

      rects.forEach((r, i) => {
        // 每个分组的内部可滚动范围 = 分组总高度 - 视口高度。
        this._groupMaxScroll[i] = Math.max(0, r.height - this._wH);
      });
    });
  },

  _scheduleMeasureLayout() {
    if (this._layoutMeasureTimer) {
      clearTimeout(this._layoutMeasureTimer);
    }

    this._layoutMeasureTimer = setTimeout(() => {
      this._layoutMeasureTimer = null;
      this._measureLayout();
      const current = this.data.currentGroup || 0;
      this._refreshVisibleState(current, this.data.groupY[current] || 0);
    }, 120);
  },

  onImgLoad() {
    this._scheduleMeasureLayout();
  },

  toggleDebugPanel() {
    this.setData({ debugCollapsed: !this.data.debugCollapsed });
  },

  _buildDebugInfo(extra = {}) {
    const stage = extra.stage || this.data.debugInfo.stage || 'idle';
    const activeGroup = extra.activeGroup ?? this._activeGidx ?? this.data.currentGroup ?? 0;
    const currentGroup = extra.currentGroup ?? this.data.currentGroup ?? 0;
    const outerY = extra.outerY ?? this.data.outerY ?? 0;
    const groupYList = extra.groupYList || this.data.groupY || [];
    const activeGroupY = extra.groupY ?? groupYList[activeGroup] ?? 0;
    const maxGroupScroll = this._groupMaxScroll[activeGroup] || 0;
    const images = this.data.groups[activeGroup]?.images || [];
    const activeImage = images.length
      ? clamp(Math.floor((-activeGroupY) / Math.max(this._wH, 1)), 0, images.length - 1)
      : 0;
    const activeImageTop = outerY + activeGroup * this._wH + activeGroupY + activeImage * this._wH;
    const activeImageProgress = images.length
      ? this._computeImageViewportProgress(activeGroup, activeImage, activeGroupY, outerY)
      : 0;
    const overscrollMeta = extra.overscrollMeta ?? this._overscrollState;
    const mode = extra.mode || this._transitionConfig.mode;
    const flowPanState = extra.flowPanState ?? this._flowPanState;

    return {
      stage,
      stageText: DEBUG_STAGE_TEXT[stage] || DEBUG_STAGE_TEXT.idle,
      activeGroup,
      currentGroup,
      activeImage,
      activeImageProgress: formatDebugNumber(activeImageProgress),
      activeImageTop: formatDebugNumber(activeImageTop),
      outerY: formatDebugNumber(outerY),
      groupY: formatDebugNumber(activeGroupY),
      currentGroupY: formatDebugNumber(groupYList[currentGroup] ?? 0),
      maxGroupScroll: formatDebugNumber(maxGroupScroll),
      velocity: formatDebugNumber(extra.velocity ?? this._lastVelocity, 3),
      mode,
      direction: overscrollMeta?.direction || 'none',
      overscroll: formatDebugNumber(overscrollMeta?.overscroll ?? 0),
      progress: formatDebugNumber(overscrollMeta?.progress ?? 0, 3),
      canSwitch: overscrollMeta?.canSwitch ? '是' : '否',
      flowPan: flowPanState ? '是' : '否',
      outerPage: formatDebugNumber(-outerY / Math.max(this._wH, 1), 3),
      threshold: formatDebugNumber(this._transitionConfig.threshold),
      velocityThreshold: formatDebugNumber(this._transitionConfig.velocityThreshold, 3),
      hint: extra.hint || 'outerY 越小，说明页面越往下一个分组移动；groupY 越小，说明当前分组内部越往下滚'
    };
  },

  _refreshVisibleState(gidx, groupY) {
    // 根据当前 outerY + groupY 重新计算可见区域动画，并同步当前主导分组。
    this._updateVisibleAnimations(this.data.outerY, { [gidx]: groupY });
    this.setData({
      currentGroup: gidx,
      debugInfo: this._buildDebugInfo({
        stage: 'idle',
        activeGroup: gidx,
        currentGroup: gidx,
        groupY,
        outerY: this.data.outerY,
        hint: '这是稳定态：可以把 outerY 看成“当前显示第几组”，把 groupY 看成“这组内部滚了多少”'
      })
    });
    this._ensureGroupEntrance(gidx, this.data.outerY);
  },

  _computeImageViewportProgress(gidx, imgIndex, groupY, outerY) {
    // 文档里的核心公式：
    // imgTop = outerY + gidx * windowHeight + groupY + imgIndex * windowHeight
    // progress = clamp(1 - imgTop / windowHeight, 0, 1)
    const imgTop = outerY + gidx * this._wH + groupY + imgIndex * this._wH;
    return clamp(1 - imgTop / this._wH, 0, 1);
  },

  _getDominantGroupByOuterY(outerY) {
    return clamp(Math.round(-outerY / this._wH), 0, this.data.groups.length - 1);
  },

  _updateVisibleAnimations(forcedOuterY, forcedGroupYMap = {}) {
    // flow 模式下可能同时看到前后两个分组，因此需要同时刷新 floor/ceil/current 三组动画。
    const outerY = forcedOuterY !== undefined ? forcedOuterY : this.data.outerY;
    const page = -outerY / this._wH;
    const candidates = new Set([
      clamp(Math.floor(page), 0, this.data.groups.length - 1),
      clamp(Math.ceil(page), 0, this.data.groups.length - 1),
      this.data.currentGroup
    ]);

    candidates.forEach((gidx) => {
      const forcedY = Object.prototype.hasOwnProperty.call(forcedGroupYMap, gidx) ? forcedGroupYMap[gidx] : undefined;
      this._updateScrollDrivenAnimations(gidx, forcedY, outerY);
    });
  },

  _updateScrollDrivenAnimations(gidx, forcedY, forcedOuterY) {
    const group = this.data.groups[gidx];
    if (!group) return;

    const groupY = forcedY !== undefined ? forcedY : this.data.groupY[gidx];
    const outerY = forcedOuterY !== undefined ? forcedOuterY : this.data.outerY;
    const updates = {};

    group.images.forEach((img, imgIndex) => {
      // 先算图片进入视口的进度，再映射到 overlay 自己的起止区间。
      const progress = this._computeImageViewportProgress(gidx, imgIndex, groupY, outerY);

      img.overlays.forEach((ov, ovIndex) => {
        const style = this._buildOverlayStyle({
          anim: ov.anim,
          progress: this._computeAnimProgress(progress, ov.anim),
          transitionStyle: 'transition: none;'
        });

        const path = `groups[${gidx}].images[${imgIndex}].overlays[${ovIndex}]._dynamicStyle`;
        if (style !== ov._dynamicStyle) {
          updates[path] = style;
          ov._dynamicStyle = style;
        }
      });
    });

    if (Object.keys(updates).length) {
      this.setData(updates);
    }
  },

  _computeAnimProgress(progress, anim) {
    // 将图片级 progress 裁切到 overlay 自己声明的 startPos/endPos 区间。
    if (progress <= anim.startPos) return 0;
    if (progress >= anim.endPos) return 1;
    return clamp((progress - anim.startPos) / (anim.endPos - anim.startPos), 0, 1);
  },

  _buildTransitionStyle(anim) {
    const duration = Number.isFinite(anim.duration) ? anim.duration : 650;
    const delay = Number.isFinite(anim.delay) ? anim.delay : 0;
    const easingMap = {
      spring: 'cubic-bezier(0.22,1,0.36,1)',
      ease: 'ease',
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out'
    };
    const easing = easingMap[anim.easing] || anim.easing || 'cubic-bezier(0.22,1,0.36,1)';
    return `transition: transform ${duration}ms ${easing} ${delay}ms, opacity ${duration}ms ${easing} ${delay}ms;`;
  },

  _buildOverlayStyle({ anim, progress, transitionStyle }) {
    const t = clamp(progress, 0, 1);
    const unit = anim.to.unit || anim.from.unit || 'rpx';
    const translateX = lerp(anim.from.x, anim.to.x, t);
    const translateY = lerp(anim.from.y, anim.to.y, t);
    const scale = lerp(anim.fromScale, anim.toScale, t);
    const opacity = lerp(anim.fromOpacity, anim.toOpacity, t);

    return [
      `transform: translate3d(${translateX}${unit}, ${translateY}${unit}, 0) scale(${scale})`,
      `opacity: ${opacity}`,
      transitionStyle || 'transition: none;'
    ].join('; ') + ';';
  },

  _playInitialEntrance(gidx, groupY, forcedOuterY) {
    const group = this.data.groups[gidx];
    if (!group) return;
    const outerY = forcedOuterY !== undefined ? forcedOuterY : this.data.outerY;

    const hiddenUpdates = {};
    const enterUpdates = {};

    group.images.forEach((img, imgIndex) => {
      const progress = this._computeImageViewportProgress(gidx, imgIndex, groupY, outerY);

      img.overlays.forEach((ov, ovIndex) => {
        const finalProgress = this._computeAnimProgress(progress, ov.anim);
        if (finalProgress <= 0) return;

        const path = `groups[${gidx}].images[${imgIndex}].overlays[${ovIndex}]._dynamicStyle`;
        hiddenUpdates[path] = this._buildOverlayStyle({
          anim: ov.anim,
          progress: 0,
          transitionStyle: 'transition: none;'
        });
        enterUpdates[path] = this._buildOverlayStyle({
          anim: ov.anim,
          progress: finalProgress,
          transitionStyle: this._buildTransitionStyle(ov.anim)
        });
      });
    });

    if (!Object.keys(enterUpdates).length) return;

    // 首次入场采用两段式渲染：
    // 1. 先强制写入隐藏态，确保动画起点一致；
    // 2. 下一帧再写入目标态，让 CSS transition 真正生效。
    this.setData(hiddenUpdates, () => {
      this.setData({
        debugInfo: this._buildDebugInfo({
          stage: 'entrance',
          activeGroup: gidx,
          groupY,
          outerY,
          hint: '你现在看到的是首屏入场动画，它不是手势触发，而是分组第一次进入视口中心时触发'
        })
      });
      this._enterTimer = setTimeout(() => {
        this.setData(enterUpdates, () => {
          this._enterTimer = setTimeout(() => {
            this._enterTimer = null;
            this._refreshVisibleState(gidx, groupY);
          }, 700);
        });
      }, 34);
    });
  },

  _ensureGroupEntrance(gidx, outerY) {
    // 每个分组只播一次入场动画，并且仅在分组接近视口中心时触发，避免过早执行。
    if (!this.data.groups[gidx]) return;
    if (this._enteredGroups[gidx]) return;

    const groupTop = outerY + gidx * this._wH;
    if (Math.abs(groupTop) > this._wH * 0.35) return;

    this._enteredGroups[gidx] = true;
    this._playInitialEntrance(gidx, this.data.groupY[gidx] || 0, outerY);
  },

  _getResistanceOffset(distance, threshold, resistance) {
    const abs = Math.abs(distance);
    const softened = threshold * (1 - Math.exp(-(abs * resistance) / Math.max(1, threshold)));
    return Math.sign(distance) * softened;
  },

  _getOverscrollMeta(gidx, candidateY) {
    // 这一层把手势拆成文档中的三个结果：
    // 1. 分组内部滚动值 groupY
    // 2. 跨分组位移 outerY
    // 3. 越界阈值进度 progress（决定提示条/是否翻组）
    const innerMax = 0;
    const innerMin = -(this._groupMaxScroll[gidx] || 0);
    const baseOuterY = -gidx * this._wH;
    const transition = this._transitionConfig;
    const nGroups = this.data.groups.length;

    let direction = null;
    let overscroll = 0;
    let boundedY = candidateY;
    let outerOffset = 0;

    if (transition.mode === 'flow') {
      // flow 模式只有真正撞到边界后，才会把继续拖拽转移到 outerY 轨道上。
      if (gidx > 0 && candidateY > innerMax) {
        direction = 'prev';
        overscroll = candidateY - innerMax;
        boundedY = innerMax;
        const flowFollow = Math.max(0.65, 1 - transition.resistance * 0.2);
        outerOffset = overscroll * flowFollow;
      } else if (gidx < nGroups - 1 && candidateY < innerMin) {
        direction = 'next';
        overscroll = candidateY - innerMin;
        boundedY = innerMin;
        const flowFollow = Math.max(0.65, 1 - transition.resistance * 0.2);
        outerOffset = overscroll * flowFollow;
      }
    } else if (candidateY > innerMax && gidx > 0) {
      direction = 'prev';
      overscroll = candidateY - innerMax;
      boundedY = innerMax;
    } else if (candidateY < innerMin && gidx < nGroups - 1) {
      direction = 'next';
      overscroll = candidateY - innerMin;
      boundedY = innerMin;
    }

    if (!direction) {
      return {
        mode: transition.mode,
        direction: null,
        groupY: clamp(candidateY, innerMin, innerMax),
        outerY: baseOuterY,
        progress: 0,
        canSwitch: false
      };
    }

    const distance = Math.abs(overscroll);
    const progress = clamp(distance / transition.threshold, 0, 1);
    const snappedOffset = this._getResistanceOffset(
      direction === 'next' ? -distance : distance,
      transition.threshold,
      transition.resistance
    );
    const finalOuterOffset = transition.mode === 'flow' ? outerOffset : snappedOffset;

    return {
      mode: transition.mode,
      direction,
      overscroll,
      groupY: boundedY,
      outerY: baseOuterY + finalOuterOffset,
      progress,
      canSwitch: progress >= 1
    };
  },

  onGStart(e) {
    this._stopAnimations();

    const gidx = e.currentTarget.dataset.gidx;
    const now = Date.now();
    this._activeGidx = gidx;
    this._touchStartY = e.touches[0].clientY;
    this._touchLastY = this._touchStartY;
    this._touchStartTime = now;
    this._touchLastTime = now;
    this._touchStartGroupY = this.data.groupY[gidx];
    this._touchStartOuterY = this.data.outerY;
    this._lastVelocity = 0;
    this._overscrollState = null;
    this._flowPanState = this._getFlowPanState();

    // 拖拽开始后，先移除 outerY 的过渡，后续位置完全由手势实时驱动。
    this.setData({
      outerEase: EASE_NONE,
      debugInfo: this._buildDebugInfo({
        stage: 'touchStart',
        activeGroup: gidx,
        groupY: this.data.groupY[gidx],
        outerY: this.data.outerY,
        hint: '先记住 touchStartY、touchStartGroupY、touchStartOuterY，后面所有位移都拿当前手指位置减这三个起点'
      })
    });
  },

  onGMove(e) {
    const gidx = this._activeGidx;
    const currentY = e.touches[0].clientY;
    const now = Date.now();
    const rawDelta = currentY - this._touchStartY;

    if (this._transitionConfig.mode === 'flow' && this._flowPanState) {
      // 如果当前已经处于两组之间，则直接续拖 outerY，避免从组内滚动重新起算造成跳变。
      this._handleFlowPanMove(rawDelta, currentY, now);
      return;
    }

    const candidateY = this._touchStartGroupY + rawDelta;
    const meta = this._getOverscrollMeta(gidx, candidateY);
    const newGroupY = [...this.data.groupY];
    newGroupY[gidx] = meta.groupY;

    const deltaT = Math.max(1, now - this._touchLastTime);
    this._lastVelocity = (currentY - this._touchLastY) / deltaT;
    this._touchLastY = currentY;
    this._touchLastTime = now;
    this._overscrollState = meta.direction ? meta : null;
    const dominantGroup = this._getDominantGroupByOuterY(meta.outerY);
    const showSpring = meta.progress > 0 && meta.progress < 1;

    // springProg 只在“越界但还没越过阈值”时显示，越过阈值后交给切组逻辑处理。
    this.setData({
      groupY: newGroupY,
      outerY: meta.outerY,
      springProg: showSpring ? Math.round(meta.progress * 100) : 0,
      springDir: meta.direction || 'next',
      currentGroup: dominantGroup,
      debugInfo: this._buildDebugInfo({
        stage: meta.direction ? 'overscroll' : 'innerScroll',
        activeGroup: gidx,
        currentGroup: dominantGroup,
        groupYList: newGroupY,
        groupY: meta.groupY,
        outerY: meta.outerY,
        velocity: this._lastVelocity,
        overscrollMeta: meta.direction ? meta : null,
        hint: meta.direction
          ? 'groupY 已经到边界了，接下来看的重点是 progress 是否到 1，以及速度是否足够切组'
          : '还在组内滚动，所以 outerY 基本保持在当前分组，只是 groupY 在变化'
      })
    });

    this._updateVisibleAnimations(meta.outerY, { [gidx]: meta.groupY });
    this._ensureGroupEntrance(dominantGroup, meta.outerY);
  },

  onGEnd() {
    const gidx = this._activeGidx;
    const meta = this._overscrollState;
    const velocity = this._lastVelocity;
    const transition = this._transitionConfig;
    const baseOuterY = -gidx * this._wH;
    const innerMin = -(this._groupMaxScroll[gidx] || 0);

    this.setData({ springProg: 0 });

    if (transition.mode === 'flow' && this._flowPanState) {
      this.setData({
        debugInfo: this._buildDebugInfo({
          stage: 'flowPan',
          activeGroup: gidx,
          velocity,
          hint: '手指松开后，会根据当前 outerY 所在比例和速度方向，决定回到哪一组'
        })
      });
      this._finishFlowPan(velocity);
      return;
    }

    if (meta?.direction) {
      const to = meta.direction === 'next' ? gidx + 1 : gidx - 1;
      const directionSign = meta.direction === 'next' ? -1 : 1;
      const directionalVelocity = velocity * directionSign;
      // 结束时满足“位移达阈值”或“甩动速度达阈值”任一条件，就执行切组。
      const shouldSwitch = meta.progress >= 1 || directionalVelocity >= transition.velocityThreshold;

      if (shouldSwitch && to >= 0 && to < this.data.groups.length) {
        this.setData({
          debugInfo: this._buildDebugInfo({
            stage: 'switchGroup',
            activeGroup: gidx,
            currentGroup: to,
            velocity,
            overscrollMeta: meta,
            hint: '满足切组条件了：要么 progress 已满，要么甩动速度足够大'
          })
        });
        if (transition.mode === 'flow') {
          this._flowSwitchGroup(gidx, to);
        } else {
          this._switchGroup(gidx, to);
        }
      } else {
        this._overscrollState = null;
        this.setData({
          debugInfo: this._buildDebugInfo({
            stage: 'snapBack',
            activeGroup: gidx,
            velocity,
            outerY: baseOuterY,
            hint: '没达到切组条件，所以 outerY 会回弹到当前分组基线'
          })
        });
        this._snapOuterTo(baseOuterY, transition.springEase);
      }
      return;
    }

    this.setData({
      debugInfo: this._buildDebugInfo({
        stage: 'fling',
        activeGroup: gidx,
        velocity,
        hint: '没有越界时，手指离开会进入惯性滚动，重点观察 velocity 如何逐帧衰减'
      })
    });
    this._startFlingAnimation(gidx, this.data.groupY[gidx], velocity, innerMin);
  },

  _getFlowPanState() {
    // 通过 outerY 判断当前是否停在两个分组中间，如果是，下次拖拽就直接续拖 outer 轨道。
    const outerPage = -this.data.outerY / this._wH;
    const from = Math.floor(outerPage);
    const progress = outerPage - from;

    if (progress <= 0.001 || progress >= 0.999) return null;
    if (from < 0 || from >= this.data.groups.length - 1) return null;

    return {
      from,
      to: from + 1
    };
  },

  _handleFlowPanMove(rawDelta, currentY, now) {
    // 从当前 outerY 继续拖，不再参考 groupY 基线，确保二次拖拽也连续。
    const state = this._flowPanState;
    const minOuterY = -state.to * this._wH;
    const maxOuterY = -state.from * this._wH;
    const outerY = clamp(this._touchStartOuterY + rawDelta, minOuterY, maxOuterY);
    const ratio = clamp((maxOuterY - outerY) / (maxOuterY - minOuterY), 0, 1);
    const dominantGroup = ratio >= 0.5 ? state.to : state.from;

    const deltaT = Math.max(1, now - this._touchLastTime);
    this._lastVelocity = (currentY - this._touchLastY) / deltaT;
    this._touchLastY = currentY;
    this._touchLastTime = now;
    this._overscrollState = {
      direction: ratio >= 0.5 ? 'next' : 'prev',
      progress: ratio
    };

    this.setData({
      outerY,
      springProg: 0,
      springDir: ratio >= 0.5 ? 'next' : 'prev',
      currentGroup: dominantGroup,
      debugInfo: this._buildDebugInfo({
        stage: 'flowPan',
        activeGroup: state.from,
        currentGroup: dominantGroup,
        outerY,
        velocity: this._lastVelocity,
        flowPanState: state,
        overscrollMeta: {
          direction: ratio >= 0.5 ? 'next' : 'prev',
          progress: ratio,
          canSwitch: ratio >= 0.5
        },
        hint: '现在 outerY 直接在两组之间平移，ratio 越接近 1，越倾向切到下一组'
      })
    });

    this._updateVisibleAnimations(outerY);
    this._ensureGroupEntrance(dominantGroup, outerY);
  },

  _finishFlowPan(velocity) {
    const state = this._flowPanState;
    this._flowPanState = null;

    if (!state) return;

    const minOuterY = -state.to * this._wH;
    const maxOuterY = -state.from * this._wH;
    const ratio = clamp((maxOuterY - this.data.outerY) / (maxOuterY - minOuterY), 0, 1);
    const byVelocity = Math.abs(velocity) >= this._transitionConfig.velocityThreshold;
    // 先看甩动速度方向，再退回到几何中点判断，符合文档里的 settle 策略。
    const target = byVelocity ? (velocity < 0 ? state.to : state.from) : (ratio >= 0.5 ? state.to : state.from);

    this._settleFlowPan(state, target);
  },

  _settleFlowPan(state, target) {
    if (this._rafId) {
      cancelFrame(this._rafId);
      this._rafId = null;
    }

    const startOuterY = this.data.outerY;
    const targetOuterY = -target * this._wH;
    const settleOuterY = targetOuterY;
    const duration = clamp(220 + Math.abs(settleOuterY - startOuterY) * 0.4, 260, 480);
    const startTime = Date.now();

    this._overscrollState = null;
    this.setData({ springProg: 0 });

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const outerY = lerp(startOuterY, settleOuterY, eased);

      this.setData({
        outerY,
        currentGroup: target,
        debugInfo: this._buildDebugInfo({
          stage: 'switchGroup',
          activeGroup: target,
          currentGroup: target,
          outerY,
          velocity: this._lastVelocity,
          hint: '这是 flow settle 阶段：outerY 正在缓动收敛到最终目标分组'
        })
      });
      this._updateVisibleAnimations(outerY);

      if (t < 1) {
        this._rafId = requestFrame(step);
        return;
      }

      this._rafId = null;
      this.setData({
        outerY: settleOuterY,
        currentGroup: target
      }, () => {
        this._ensureGroupEntrance(target, settleOuterY);
        this._refreshVisibleState(target, this.data.groupY[target] || 0);
      });
    };

    this._rafId = requestFrame(step);
  },

  _snapOuterTo(targetOuterY, ease) {
    this.setData({ outerY: targetOuterY, outerEase: ease || this._transitionConfig.springEase });
    this._outerEaseTimer = setTimeout(() => {
      this.setData({ outerEase: EASE_NONE });
      this._outerEaseTimer = null;
    }, 560);
  },

  _startFlingAnimation(gidx, startY, velocity, innerMin) {
    if (Math.abs(velocity) < 0.02) {
      this._refreshVisibleState(gidx, startY);
      return;
    }

    let y = startY;
    let v = velocity * 1000;
    let lastTs = null;
    const friction = 0.0038;

    const step = (ts) => {
      if (lastTs === null) {
        lastTs = ts;
      }

      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;

      v *= Math.exp(-friction * dt);
      y += (v * dt) / 1000;

      if (y > 0 || y < innerMin) {
        // 惯性滚动撞到上下边界时立即夹紧，并衰减速度，避免穿透。
        y = clamp(y, innerMin, 0);
        v *= 0.2;
      }

      const newGroupY = [...this.data.groupY];
      newGroupY[gidx] = y;
      this.setData({
        groupY: newGroupY,
        debugInfo: this._buildDebugInfo({
          stage: 'fling',
          activeGroup: gidx,
          groupYList: newGroupY,
          groupY: y,
          velocity: v / 1000,
          hint: '惯性阶段里最重要的是两个量：groupY 在继续变化，velocity 在摩擦作用下逐步变小'
        })
      });
      this._updateVisibleAnimations(this.data.outerY, { [gidx]: y });

      if (Math.abs(v) < 12 || y === 0 || y === innerMin) {
        this._rafId = null;
        this._refreshVisibleState(gidx, y);
        return;
      }

      this._rafId = requestFrame(step);
    };

    this._rafId = requestFrame(step);
  },

  _switchGroup(from, to) {
    const targetOuterY = -to * this._wH;
    const newGroupY = [...this.data.groupY];

    this._overscrollState = null;
    this.setData({
      outerY: targetOuterY,
      outerEase: this._transitionConfig.switchEase,
      currentGroup: to,
      groupY: newGroupY,
      debugInfo: this._buildDebugInfo({
        stage: 'switchGroup',
        activeGroup: to,
        currentGroup: to,
        groupYList: newGroupY,
        outerY: targetOuterY,
        hint: 'snap 模式下不是逐帧推 outerY，而是直接设置目标 outerY，再交给 CSS transition 完成切换'
      })
    }, () => {
      this._ensureGroupEntrance(to, targetOuterY);
      this._refreshVisibleState(to, newGroupY[to] || 0);
    });

    this._outerEaseTimer = setTimeout(() => {
      this.setData({ outerEase: EASE_NONE });
      this._outerEaseTimer = null;
    }, 520);
  },

  _flowSwitchGroup(from, to) {
    if (this._rafId) {
      cancelFrame(this._rafId);
      this._rafId = null;
    }

    const startOuterY = this.data.outerY;
    const targetOuterY = -to * this._wH;
    const newGroupY = [...this.data.groupY];
    const settleOuterY = targetOuterY;

    this._overscrollState = null;
    this.setData({
      outerEase: EASE_NONE,
      groupY: newGroupY,
      currentGroup: from,
      debugInfo: this._buildDebugInfo({
        stage: 'switchGroup',
        activeGroup: from,
        currentGroup: from,
        groupYList: newGroupY,
        outerY: startOuterY,
        hint: 'flow 模式切组会逐帧 lerp outerY，所以你能更清楚看到两个分组交替可见'
      })
    });

    const distance = Math.abs(targetOuterY - startOuterY);
    const duration = clamp(280 + distance * 0.45, 320, 620);
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const outerY = lerp(startOuterY, targetOuterY, eased);

      this.setData({
        outerY,
        debugInfo: this._buildDebugInfo({
          stage: 'switchGroup',
          activeGroup: to,
          currentGroup: to,
          outerY,
          hint: '切组动画进行中：outerY 正在从起点平滑过渡到目标分组位置'
        })
      });
      this._updateVisibleAnimations(outerY);

      if (t < 1) {
        this._rafId = requestFrame(step);
        return;
      }

      this._rafId = null;
      this.setData({
        outerY: settleOuterY,
        currentGroup: to
      }, () => {
        this._ensureGroupEntrance(to, settleOuterY);
        this._refreshVisibleState(to, newGroupY[to] || 0);
      });
    };

    this._rafId = requestFrame(step);
  }
});
