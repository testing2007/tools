// ================================================================
// index.js  v9.0 — snap / flow 混合滚动驱动动画
//
// 【架构重构】
//   核心思路：将所有组展平为一条虚拟长轨道
//   用一个统一的 scrollY 控制全局偏移
//
//   - flow 组：与前一组无缝衔接，连续滚动
//   - snap 组：滚动到组边界时产生弹簧阻力，松手后吸附
//
//   统一 scrollY 的好处：
//   · 不再需要 outerY + groupY 双层偏移
//   · flow 组之间天然连续
//   · 动画进度计算统一基于全局 scrollY
// ================================================================

const PRODUCT_CONFIG = require('../../data/productConfig');

// 物理常量
const RESISTANCE   = 0.28;
const DIST_THRESH  = 80;
const VEL_THRESH   = 0.40;
const DECELERATION = 0.002;  // px/ms²

// 过渡曲线
const EASE_SPRING = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
const EASE_SWITCH = 'transform 0.48s cubic-bezier(0.22,1,0.36,1)';
const EASE_NONE   = 'none';

Page({
  data: {
    groups:       [],
    trackY:       0,        // 统一轨道偏移
    trackEase:    EASE_NONE,
    currentGroup: 0,
    springProg:   0,
    springDir:    'next',

    // ---- 给 wxml 渲染用的扁平化布局信息 ----
    // 每张图片在全局轨道中的绝对 top
    imageLayout:  [],       // [{ id, globalTop, gidx, imgIdx }]
  },

  // ---- 私有 ----
  _wH:               0,
  _scrollY:          0,     // 当前真实 scrollY（正数表示往下滚了多少）
  _trackTotalHeight: 0,     // 轨道总高度
  _groupOffsets:     [],    // 每组在轨道中的起始 Y
  _groupHeights:     [],    // 每组的总高度
  _snapBoundaries:   [],    // snap 边界列表 [{ y, fromGroup, toGroup }]
  _imageGlobalTops:  [],    // 每张图片的全局 top（用于动画计算）

  _touchStartY:      0,
  _touchStartTime:   0,
  _touchStartScrollY: 0,
  _rafId:            null,
  _isSnapping:       false, // 是否正在执行 snap 动画

  // ================================================================
  //  onLoad
  // ================================================================
  onLoad() {
    const sys = wx.getSystemInfoSync();
    this._wH = sys.windowHeight;

    const groups = PRODUCT_CONFIG.groups;

    // 预处理 overlays 默认值
    groups.forEach(g => {
      g.transition = g.transition || 'snap';
      g.images.forEach(img => {
        img.overlays = img.overlays || [];
        img.overlays.forEach(ov => {
          ov.pos  = ov.pos  || { x: 20, y: 20 };
          ov.anim = ov.anim || { type: 'fade', startPos: 0.2, endPos: 0.8 };
          ov.anim.startPos = ov.anim.startPos ?? 0.2;
          ov.anim.endPos   = ov.anim.endPos   ?? 0.8;
          ov.style = ov.style || {
            color: '#111', fontSize: 28, fontWeight: '700',
            bgColor: 'rgba(255,255,255,0.9)', bgBlur: true, boxShadow: true
          };
          ov._dynamicStyle = 'opacity:0; transform:translateY(60rpx);';
        });
      });
    });

    // ---- 计算布局 ----
    this._buildLayout(groups);

    this.setData({
      groups,
      currentGroup: 0,
      trackY: 0,
    }, () => {
      this._applyScrollPosition(0);
    });
  },

  onUnload() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  },

  // ================================================================
  //  布局计算
  //  每张图片占一个视口高度（widthFix 图片按满屏算）
  //  后续可改为实际测量
  // ================================================================
  _buildLayout(groups) {
    const wH = this._wH;
    let   cursor = 0;  // 当前累加高度

    this._groupOffsets  = [];
    this._groupHeights  = [];
    this._snapBoundaries = [];
    this._imageGlobalTops = [];

    const imageLayout = [];

    groups.forEach((g, gidx) => {
      this._groupOffsets[gidx] = cursor;

      const groupH = g.images.length * wH;
      this._groupHeights[gidx] = groupH;

      g.images.forEach((img, imgIdx) => {
        const globalTop = cursor + imgIdx * wH;
        this._imageGlobalTops.push({ gidx, imgIdx, globalTop, id: img.id });
        imageLayout.push({ id: img.id, globalTop, gidx, imgIdx });
      });

      cursor += groupH;

      // 判断组间过渡类型，在 snap 边界处记录
      if (gidx < groups.length - 1) {
        const transition = g.transition || 'snap';
        if (transition === 'snap') {
          // snap 边界 = 本组最后一屏底部
          this._snapBoundaries.push({
            y:         cursor - wH,  // 本组最后一张图片 scrollY 值
            maxScroll: cursor - wH,  // 这个位置是本组可滚到的最大值
            fromGroup: gidx,
            toGroup:   gidx + 1,
            nextGroupStart: cursor,  // 下一组第一张图片的 scrollY
          });
        }
        // flow：不添加边界，连续滚动
      }
    });

    // 也需要处理往回滚的 snap 边界（反向）
    // 复用同一个边界数组，方向在运行时判断

    this._trackTotalHeight = cursor;
    this.data.imageLayout  = imageLayout;
  },

  // ================================================================
  //  全局 scrollY → 画面更新
  // ================================================================
  _applyScrollPosition(scrollY) {
    this._scrollY = scrollY;

    // 1. 更新轨道偏移
    this.setData({ trackY: -scrollY });

    // 2. 计算当前组
    const currentGroup = this._findCurrentGroup(scrollY);
    if (currentGroup !== this.data.currentGroup) {
      this.setData({ currentGroup });
    }

    // 3. 更新所有可见范围内的浮层动画
    this._updateAllAnimations(scrollY);
  },

  _findCurrentGroup(scrollY) {
    const groups = this.data.groups;
    for (let i = groups.length - 1; i >= 0; i--) {
      if (scrollY >= this._groupOffsets[i]) return i;
    }
    return 0;
  },

  // ================================================================
  //  滚动驱动动画：基于全局 scrollY 计算每个 overlay 进度
  // ================================================================
  _updateAllAnimations(scrollY) {
    const wH      = this._wH;
    const updates  = {};
    const groups   = this.data.groups;

    // 只更新视口附近的图片（前后各 1 屏缓冲）
    const viewTop    = scrollY - wH;
    const viewBottom = scrollY + wH * 2;

    this._imageGlobalTops.forEach(({ gidx, imgIdx, globalTop }) => {
      if (globalTop + wH < viewTop || globalTop > viewBottom) return;

      const img = groups[gidx].images[imgIdx];
      if (!img || !img.overlays.length) return;

      // progress: 图片从视口底部进入到顶部的进度 (0~1)
      // 当 scrollY == globalTop 时，图片顶端在视口顶端 → progress = 1
      // 当 scrollY == globalTop - wH 时，图片顶端在视口底端 → progress = 0
      const progress = Math.max(0, Math.min(1, (scrollY - (globalTop - wH)) / wH));

      img.overlays.forEach((ov, ovIdx) => {
        const { startPos, endPos } = ov.anim;
        let t = 0;
        if (progress >= startPos && endPos > startPos) {
          t = Math.min(1, (progress - startPos) / (endPos - startPos));
        }

        const transform = this._computeOverlayTransform(ov, t);
        const opacity   = t;
        const style     = `transform:${transform}; opacity:${opacity}; transition:none;`;
        const path      = `groups[${gidx}].images[${imgIdx}].overlays[${ovIdx}]._dynamicStyle`;
        updates[path]   = style;
      });
    });

    if (Object.keys(updates).length) {
      this.setData(updates);
    }
  },

  _computeOverlayTransform(ov, t) {
    const distance = 60;
    switch (ov.anim.type) {
      case 'slideX_left':
        return `translateX(${(1 - t) * -distance}rpx)`;
      case 'slideX_right':
        return `translateX(${(1 - t) * distance}rpx)`;
      case 'slideY':
        return `translateY(${(1 - t) * distance}rpx)`;
      case 'zoom':
        return `scale(${0.8 + 0.2 * t})`;
      case 'fade':
      default:
        return 'translateX(0)';
    }
  },

  // ================================================================
  //  触摸处理
  // ================================================================
  onGStart(e) {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._isSnapping        = false;
    this._touchStartY       = e.touches[0].clientY;
    this._touchStartTime    = Date.now();
    this._touchStartScrollY = this._scrollY;

    this.setData({ trackEase: EASE_NONE, springProg: 0 });
  },

  onGMove(e) {
    if (this._isSnapping) return;

    const touchY   = e.touches[0].clientY;
    const rawDelta = this._touchStartY - touchY;  // 正 = 手指上滑 = 内容往上 = scrollY 增大
    let   newScrollY = this._touchStartScrollY + rawDelta;

    const maxScrollY = this._trackTotalHeight - this._wH;

    // ---- 检查 snap 边界 ----
    const snapResult = this._checkSnapBoundary(newScrollY, rawDelta);

    if (snapResult) {
      // 在 snap 弹簧区
      const { boundary, overscroll, direction } = snapResult;

      // 施加弹簧阻力
      const clampedScroll = direction === 'down'
        ? boundary.maxScroll + overscroll * RESISTANCE
        : boundary.nextGroupStart - this._wH + overscroll * RESISTANCE;

      const prog = Math.min(100, Math.round(Math.abs(overscroll) / DIST_THRESH * 100));

      this._scrollY = clampedScroll;
      this.setData({
        trackY:     -clampedScroll,
        springProg: prog,
        springDir:  direction === 'down' ? 'next' : 'prev',
      });

      // 即使在弹簧区也更新动画
      this._updateAllAnimations(clampedScroll);
    } else {
      // 全局边界夹紧
      newScrollY = Math.max(0, Math.min(maxScrollY, newScrollY));
      this._applyScrollPosition(newScrollY);
    }
  },

  onGEnd(e) {
    if (this._isSnapping) return;

    const delta  = this._touchStartY - e.changedTouches[0].clientY; // 正 = 上滑
    const dt     = Math.max(1, Date.now() - this._touchStartTime);
    const vel    = delta / dt;  // px/ms，正 = 上滑

    this.setData({ springProg: 0 });

    // ---- 检查是否触发 snap 切换 ----
    const snapResult = this._checkSnapBoundary(this._scrollY, delta);

    if (snapResult) {
      const { boundary, overscroll, direction } = snapResult;
      const absOverscroll = Math.abs(overscroll);
      const absVel        = Math.abs(vel);

      const shouldSwitch = absOverscroll > DIST_THRESH * RESISTANCE || absVel > VEL_THRESH;

      if (shouldSwitch) {
        // 执行 snap 切换
        const targetScrollY = direction === 'down'
          ? boundary.nextGroupStart
          : boundary.maxScroll;

        this._snapToPosition(targetScrollY);
      } else {
        // 弹回原位
        const bounceBackY = direction === 'down'
          ? boundary.maxScroll
          : boundary.nextGroupStart;

        this._snapToPosition(bounceBackY);
      }
      return;
    }

    // ---- 普通惯性滚动 ----
    this._startFling(vel);
  },

  // ================================================================
  //  snap 边界检测
  // ================================================================
  /**
   * 检查 scrollY 是否落在某个 snap 边界的弹簧区
   * @returns null 或 { boundary, overscroll, direction }
   */
  _checkSnapBoundary(scrollY, deltaFromStart) {
    for (const b of this._snapBoundaries) {
      // 下滑过界：scrollY 超过了本组允许的最大值
      if (scrollY > b.maxScroll && scrollY < b.nextGroupStart) {
        return {
          boundary:   b,
          overscroll: scrollY - b.maxScroll,
          direction:  'down',   // 往下翻（手指上滑）
        };
      }

      // 上滑过界：scrollY 小于下一组起始点但仍在边界区
      // 即从 toGroup 往回滚
      if (scrollY < b.nextGroupStart && scrollY > b.maxScroll) {
        // 这个 case 已被上面覆盖
        // 但我们需要判断方向
        if (deltaFromStart < 0) {
          return {
            boundary:   b,
            overscroll: scrollY - b.nextGroupStart,  // 负值
            direction:  'up',
          };
        }
      }
    }
    return null;
  },

  // ================================================================
  //  snap 动画
  // ================================================================
  _snapToPosition(targetScrollY) {
    this._isSnapping = true;
    this._scrollY    = targetScrollY;

    this.setData({
      trackY:    -targetScrollY,
      trackEase: EASE_SWITCH,
    });

    // 切换后更新动画
    this._updateAllAnimations(targetScrollY);

    const currentGroup = this._findCurrentGroup(targetScrollY);
    if (currentGroup !== this.data.currentGroup) {
      this.setData({ currentGroup });
    }

    setTimeout(() => {
      this._isSnapping = false;
      this.setData({ trackEase: EASE_NONE });
    }, 520);
  },

  // ================================================================
  //  RAF 惯性动画
  // ================================================================
  _startFling(velocity) {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (Math.abs(velocity) < 0.1) return;

    const maxScrollY = this._trackTotalHeight - this._wH;
    let   currentY   = this._scrollY;
    let   v          = velocity;  // px/ms
    let   lastTime   = Date.now();

    const step = () => {
      const now = Date.now();
      const dt  = now - lastTime;
      lastTime  = now;

      // 减速
      const sign = v > 0 ? 1 : -1;
      v = v - sign * DECELERATION * dt;

      // 速度归零或反向 → 停止
      if (sign * v <= 0) {
        this._rafId = null;
        return;
      }

      currentY += v * dt;

      // ---- 检查 snap 边界 ----
      for (const b of this._snapBoundaries) {
        // 惯性滚动中碰到 snap 边界 → 吸附
        if (v > 0 && currentY > b.maxScroll && currentY < b.nextGroupStart) {
          // 速度足够大 → 直接 snap 到下一组
          if (Math.abs(v) > VEL_THRESH * 0.5) {
            this._snapToPosition(b.nextGroupStart);
          } else {
            this._snapToPosition(b.maxScroll);
          }
          this._rafId = null;
          return;
        }
        if (v < 0 && currentY < b.nextGroupStart && currentY > b.maxScroll) {
          if (Math.abs(v) > VEL_THRESH * 0.5) {
            this._snapToPosition(b.maxScroll);
          } else {
            this._snapToPosition(b.nextGroupStart);
          }
          this._rafId = null;
          return;
        }
      }

      // 全局边界
      currentY = Math.max(0, Math.min(maxScrollY, currentY));
      this._applyScrollPosition(currentY);

      if (currentY <= 0 || currentY >= maxScrollY) {
        this._rafId = null;
        return;
      }

      this._rafId = requestAnimationFrame(step);
    };

    this._rafId = requestAnimationFrame(step);
  },
});