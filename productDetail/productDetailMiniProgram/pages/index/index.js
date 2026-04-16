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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, t) {
  return from + (to - from) * t;
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
    springDir: 'next'
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

    // Normalize config once on load so runtime math can stay simple.
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
      currentGroup: 0
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
      cancelAnimationFrame(this._rafId);
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

  _refreshVisibleState(gidx, groupY) {
    // Refresh overlay styles with the latest outer+inner positions.
    this._updateVisibleAnimations(this.data.outerY, { [gidx]: groupY });
    this.setData({ currentGroup: gidx });
    this._ensureGroupEntrance(gidx, this.data.outerY);
  },

  _computeImageViewportProgress(gidx, imgIndex, groupY, outerY) {
    const imgTop = outerY + gidx * this._wH + groupY + imgIndex * this._wH;
    return clamp(1 - imgTop / this._wH, 0, 1);
  },

  _getDominantGroupByOuterY(outerY) {
    return clamp(Math.round(-outerY / this._wH), 0, this.data.groups.length - 1);
  },

  _updateVisibleAnimations(forcedOuterY, forcedGroupYMap = {}) {
    // When two groups are partially visible (flow mode), both need animation updates.
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

    // Two-step render: force hidden frame first, then animate to visible frame.
    this.setData(hiddenUpdates, () => {
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
    // Entrance animation should run once per group, when the group is near viewport center.
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
    // Returns the current gesture decomposition:
    // 1) inner scroll offset (groupY)
    // 2) cross-group displacement (outerY)
    // 3) threshold progress used for spring tip / switch decision
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
      // Flow mode only applies cross-group drag after real boundary break.
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

    this.setData({ outerEase: EASE_NONE });
  },

  onGMove(e) {
    const gidx = this._activeGidx;
    const currentY = e.touches[0].clientY;
    const now = Date.now();
    const rawDelta = currentY - this._touchStartY;

    if (this._transitionConfig.mode === 'flow' && this._flowPanState) {
      // If we are already between two groups, keep dragging the outer track continuously.
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

    this.setData({
      groupY: newGroupY,
      outerY: meta.outerY,
      springProg: showSpring ? Math.round(meta.progress * 100) : 0,
      springDir: meta.direction || 'next',
      currentGroup: dominantGroup
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
      this._finishFlowPan(velocity);
      return;
    }

    if (meta?.direction) {
      const to = meta.direction === 'next' ? gidx + 1 : gidx - 1;
      const directionSign = meta.direction === 'next' ? -1 : 1;
      const directionalVelocity = velocity * directionSign;
      const shouldSwitch = meta.progress >= 1 || directionalVelocity >= transition.velocityThreshold;

      if (shouldSwitch && to >= 0 && to < this.data.groups.length) {
        if (transition.mode === 'flow') {
          this._flowSwitchGroup(gidx, to);
        } else {
          this._switchGroup(gidx, to);
        }
      } else {
        this._overscrollState = null;
        this._snapOuterTo(baseOuterY, transition.springEase);
      }
      return;
    }

    this._startFlingAnimation(gidx, this.data.groupY[gidx], velocity, innerMin);
  },

  _getFlowPanState() {
    // Detect "between pages" state from outer track position.
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
    // Continue from current outerY instead of restarting from group baseline.
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
      currentGroup: dominantGroup
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
    // Settle target by velocity first; fallback to geometric midpoint.
    const target = byVelocity ? (velocity < 0 ? state.to : state.from) : (ratio >= 0.5 ? state.to : state.from);

    this._settleFlowPan(state, target);
  },

  _settleFlowPan(state, target) {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
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
        currentGroup: target
      });
      this._updateVisibleAnimations(outerY);

      if (t < 1) {
        this._rafId = requestAnimationFrame(step);
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

    this._rafId = requestAnimationFrame(step);
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
        y = clamp(y, innerMin, 0);
        v *= 0.2;
      }

      const newGroupY = [...this.data.groupY];
      newGroupY[gidx] = y;
      this.setData({ groupY: newGroupY });
      this._updateVisibleAnimations(this.data.outerY, { [gidx]: y });

      if (Math.abs(v) < 12 || y === 0 || y === innerMin) {
        this._rafId = null;
        this._refreshVisibleState(gidx, y);
        return;
      }

      this._rafId = requestAnimationFrame(step);
    };

    this._rafId = requestAnimationFrame(step);
  },

  _switchGroup(from, to) {
    const targetOuterY = -to * this._wH;
    const newGroupY = [...this.data.groupY];

    this._overscrollState = null;
    this.setData({
      outerY: targetOuterY,
      outerEase: this._transitionConfig.switchEase,
      currentGroup: to,
      groupY: newGroupY
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
      cancelAnimationFrame(this._rafId);
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
      currentGroup: from
    });

    const distance = Math.abs(targetOuterY - startOuterY);
    const duration = clamp(280 + distance * 0.45, 320, 620);
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const outerY = lerp(startOuterY, targetOuterY, eased);

      this.setData({ outerY });
      this._updateVisibleAnimations(outerY);

      if (t < 1) {
        this._rafId = requestAnimationFrame(step);
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

    this._rafId = requestAnimationFrame(step);
  }
});
