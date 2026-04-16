// ================================================================
// index.js  v8.1 — 滚动驱动动画 (Scroll-Driven Animation)
//
// 【重构要点】
//   1. 废弃 IntersectionObserver，改为 1:1 跟手滚动驱动
//   2. 惯性滚动改为 JS RAF (requestAnimationFrame) 驱动
//   3. 支持 startPos / endPos (0~1) 进度映射动画
//   4. 优化 setData，通过 forcedY 解决异步状态滞后问题
// ================================================================

const PRODUCT_CONFIG = require('../../data/productConfig');

// 弹簧物理常量 (保持通用)
const RESISTANCE  = 0.28;   // 边界阻力
const DIST_THRESH = 80;     // 换组所需最小位移
const VEL_THRESH  = 0.40;   // 换组所需最小速度

// 过渡曲线（仅用于跨组切换这种非 1:1 场景）
const EASE_SPRING = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
const EASE_SWITCH = 'transform 0.48s cubic-bezier(0.22,1,0.36,1)';
const EASE_NONE   = 'none';

Page({
  data: {
    groups:        [],      // 核心配置
    outerY:        0,       // 外层轨道 Y
    outerEase:     EASE_NONE,
    groupY:        [],      // 每组内容偏移 Y
    groupEase:     [],
    currentGroup:  0,
    springProg:    0,       // 换组进度指示
    springDir:     'next'
  },

  // 私有变量
  _wH:             0,
  _groupMaxScroll: [],
  _activeGidx:     0,
  _touchStartY:    0,
  _touchStartTime: 0,
  _touchStartGroupY: 0,
  _rafId:          null,

  // ================================================================
  //  onLoad：初始化与数据预处理
  // ================================================================
  onLoad() {
    const sys = wx.getSystemInfoSync();
    this._wH = sys.windowHeight;

    const groups = PRODUCT_CONFIG.groups;
    const nGroups = groups.length;

    // 预处理 Overlays：赋予默认值、初始化动态样式字段
    groups.forEach(g => {
      g.images.forEach(img => {
        img.overlays.forEach(ov => {
          ov.pos = ov.pos || { x: 20, y: 20 };
          ov.anim = ov.anim || { type: 'fade', startPos: 0.2, endPos: 0.8 };
          ov.anim.startPos = ov.anim.startPos ?? 0.2;
          ov.anim.endPos = ov.anim.endPos ?? 0.8;
          ov.style = ov.style || { 
            color: '#111', fontSize: 28, fontWeight: '700', 
            bgColor: 'rgba(255,255,255,0.9)', bgBlur: true, boxShadow: true 
          };
          ov._dynamicStyle = ''; // 占位
        });
      });
    });

    this._groupMaxScroll = new Array(nGroups).fill(0);

    this.setData({
      groups,
      groupY:    new Array(nGroups).fill(0),
      groupEase: new Array(nGroups).fill(EASE_NONE),
      currentGroup: 0
    }, () => {
      // 延迟测量并触发初始渲染
      setTimeout(() => {
        this._measureLayout();
        this._updateScrollDrivenAnimations(0);
      }, 300);
    });
  },

  onUnload() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  },

  // 查询每组内容真实高度（计算滚动边界）
  _measureLayout() {
    const q = this.createSelectorQuery();
    this.data.groups.forEach((_, i) => q.select(`#gc-${i}`).boundingClientRect());
    q.exec(rects => {
      if (!rects || rects.some(r => !r)) {
        setTimeout(() => this._measureLayout(), 400);
        return;
      }
      rects.forEach((r, i) => {
        this._groupMaxScroll[i] = Math.max(0, r.height - this._wH);
      });
    });
  },

  // ================================================================
  //  核心算法：滚动驱动动画计算
  // ================================================================

  /**
   * 更新指定组的所有浮层动画样式
   * @param {Number} gidx 组索引
   * @param {Number} forcedY 强制指定的偏移量（优先使用，解决 setData 延迟）
   */
  _updateScrollDrivenAnimations(gidx, forcedY) {
    const group = this.data.groups[gidx];
    if (!group) return;

    const groupY = (forcedY !== undefined) ? forcedY : this.data.groupY[gidx];
    const wH     = this._wH;
    const updates = {};

    group.images.forEach((img, imgIndex) => {
      // 计算图片顶部相对于视口的可见进度
      const imgTop = imgIndex * wH + groupY;
      const progress = Math.max(0, Math.min(1, 1 - imgTop / wH));

      img.overlays.forEach((ov, ovIndex) => {
        const { startPos, endPos } = ov.anim;
        // 计算插值因子 t (0~1)
        let t = 0;
        if (progress >= startPos) {
          t = Math.min(1, (progress - startPos) / (endPos - startPos));
        }

        const transform = this._computeOverlayTransform(ov, t);
        const opacity   = t;

        const style = `transform: ${transform}; opacity: ${opacity}; transition: none;`;
        const path  = `groups[${gidx}].images[${imgIndex}].overlays[${ovIndex}]._dynamicStyle`;
        updates[path] = style;
      });
    });

    if (Object.keys(updates).length) {
      this.setData(updates);
    }
  },

  // 根据进度 t 生成 transform 字符串
  _computeOverlayTransform(ov, t) {
    const type = ov.anim.type;
    const distance = 60; // 交互飞入的基础距离 (rpx)

    switch (type) {
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
        return `translateX(0)`;
    }
  },

  // ================================================================
  //  触摸事件与物理引擎
  // ================================================================

  onGStart(e) {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    
    const gidx = e.currentTarget.dataset.gidx;
    this._activeGidx       = gidx;
    this._touchStartY      = e.touches[0].clientY;
    this._touchStartTime   = Date.now();
    this._touchStartGroupY = this.data.groupY[gidx];

    const newGroupEase = [...this.data.groupEase];
    newGroupEase[gidx] = EASE_NONE;
    this.setData({ groupEase: newGroupEase, outerEase: EASE_NONE });
  },

  onGMove(e) {
    const gidx     = this._activeGidx;
    const rawDelta = e.touches[0].clientY - this._touchStartY;
    const newGY    = this._touchStartGroupY + rawDelta;

    const innerMax = 0;
    const innerMin = -(this._groupMaxScroll[gidx] || 0);
    const baseOuterY = -gidx * this._wH;
    const nGroups    = this.data.groups.length;
    const newGroupY  = [...this.data.groupY];

    if (newGY > innerMax) {
      // ① 顶部境界（弹簧区）
      if (gidx > 0) {
        const overscroll = newGY;
        const springY    = baseOuterY + overscroll * RESISTANCE;
        const prog       = Math.min(100, Math.round(overscroll / DIST_THRESH * 100));
        newGroupY[gidx]  = innerMax;
        this.setData({ groupY: newGroupY, outerY: springY, springProg: prog, springDir: 'prev' });
      } else {
        newGroupY[gidx] = innerMax;
        this.setData({ groupY: newGroupY, outerY: baseOuterY });
      }
    } else if (newGY < innerMin) {
      // ② 底部境界（弹簧区）
      if (gidx < nGroups - 1) {
        const overscroll = newGY - innerMin; 
        const springY    = baseOuterY + overscroll * RESISTANCE;
        const prog       = Math.min(100, Math.round(Math.abs(overscroll) / DIST_THRESH * 100));
        newGroupY[gidx]  = innerMin;
        this.setData({ groupY: newGroupY, outerY: springY, springProg: prog, springDir: 'next' });
      } else {
        newGroupY[gidx] = innerMin;
        this.setData({ groupY: newGroupY, outerY: baseOuterY });
      }
    } else {
      // ③ 正常组内自由滚动
      newGroupY[gidx] = newGY;
      this.setData({ groupY: newGroupY, outerY: baseOuterY, springProg: 0 });
    }

    // 更新 1:1 动画（传入最新的 newGY 避免滞后）
    this._updateScrollDrivenAnimations(gidx, newGY);
  },

  onGEnd(e) {
    const gidx       = this._activeGidx;
    const delta      = e.changedTouches[0].clientY - this._touchStartY;
    const dt         = Math.max(1, Date.now() - this._touchStartTime);
    const vel        = delta / dt;
    const baseOuterY = -gidx * this._wH;
    const nGroups    = this.data.groups.length;

    this.setData({ springProg: 0 });

    const outerDiff = this.data.outerY - baseOuterY;

    if (outerDiff < -8) {
      // 下翻组
      const hasForce = delta < -DIST_THRESH || vel < -VEL_THRESH;
      if (hasForce && gidx < nGroups - 1) {
        this._switchGroup(gidx, gidx + 1);
      } else {
        this.setData({ outerY: baseOuterY, outerEase: EASE_SPRING });
        setTimeout(() => this.setData({ outerEase: EASE_NONE }), 600);
      }
    } else if (outerDiff > 8) {
      // 上翻组
      const hasForce = delta > DIST_THRESH || vel > VEL_THRESH;
      if (hasForce && gidx > 0) {
        this._switchGroup(gidx, gidx - 1);
      } else {
        this.setData({ outerY: baseOuterY, outerEase: EASE_SPRING });
        setTimeout(() => this.setData({ outerEase: EASE_NONE }), 600);
      }
    } else {
      // 正常组内惯性分支（JS RAF 驱动）
      const innerMin = -(this._groupMaxScroll[gidx] || 0);
      this._startFlingAnimation(gidx, this.data.groupY[gidx], vel, innerMin);
    }
  },

  // ================================================================
  //  RAF 惯性动画逻辑
  // ================================================================
  _startFlingAnimation(gidx, startY, velocity, innerMin) {
    if (this._rafId) cancelAnimationFrame(this._rafId);

    const deceleration = 0.002; // 模拟阻力 px/ms²
    const startTime    = Date.now();
    let   v            = Math.abs(velocity);
    const direction    = velocity > 0 ? 1 : -1;

    const step = () => {
      const now = Date.now();
      const dt  = now - startTime;
      v = Math.abs(velocity) - deceleration * dt;

      if (v <= 0) {
        this._rafId = null;
        this._updateScrollDrivenAnimations(gidx);
        return;
      }

      // 计算本帧位移（按标准 60fps 估算，实际 dt 会更准，此处简化处理）
      const delta = direction * v * 16.6; 
      let newY = startY + delta;
      
      // 边界夹紧
      const clampedY = Math.max(innerMin, Math.min(0, newY));

      const newGroupY = [...this.data.groupY];
      newGroupY[gidx] = clampedY;
      this.setData({ groupY: newGroupY });

      // 实时同步动画
      this._updateScrollDrivenAnimations(gidx, clampedY);

      if (clampedY === innerMin || clampedY === 0) {
        this._rafId = null;
        return;
      }

      this._rafId = requestAnimationFrame(step);
    };

    this._rafId = requestAnimationFrame(step);
  },

  // 组切换逻辑
  _switchGroup(from, to) {
    const targetOuterY = -to * this._wH;
    const newGroupY = [...this.data.groupY];
    const newGroupEase = [...this.data.groupEase];

    if (to > from) {
      newGroupY[to] = 0;
      newGroupEase[to] = EASE_NONE;
    }

    this.setData({
      outerY: targetOuterY,
      outerEase: EASE_SWITCH,
      currentGroup: to,
      groupY: newGroupY,
      groupEase: newGroupEase
    }, () => {
      // 切换完成后强制刷新动画预览
      this._updateScrollDrivenAnimations(to);
    });

    setTimeout(() => this.setData({ outerEase: EASE_NONE }), 520);
  }
});