// ================================================================
// index.js  v7.1 — 数据驱动 + N 组通用物理引擎
//
// 【数据流】
//   productConfig.js → onLoad 初始化 data.groups / animMap / groupY / groupEase
//   WXML 通过 wx:for 动态渲染所有组和图片（无硬编码）
//
// 【物理引擎】（通用，支持 N 个组）
//   onGStart/Move/End 通过 data-gidx 区分当前操作的是哪个组
//
//   组内正常拖动（newGY ∈ [innerMin, 0]）：
//     → 只更新 groupY[gidx]，outerY 保持在 -gidx*wH
//
//   拖动超过底部 / 顶部边界：
//     → groupY 夹住，outerY 向相邻组方向产生弹簧位移（×RESISTANCE 阻力）
//
//   松手判断：
//     · 位移/速度超过阈值 → EASE_SWITCH 切换到相邻组
//     · 未超阈值          → EASE_SPRING（超调曲线）弹回当前组
//
//   组内惯性：
//     · 无弹簧位移时，松手后用 vel*220ms 估算目标，EASE_FLING 滑过去
//
// 【动画】
//   IntersectionObserver 相对 .viewport 观察每张图片进出视口
//   animMap[imgId] 驱动 CSS 三态（initial / visible / exiting）
//   setData 使用点路径（'animMap.img0'）做最小粒度更新
//
// 【多组黑屏解决】
//   所有组始终在 DOM 中（无 wx:if），靠 outerY 决定哪组可见
//   切换时目标组已预渲染，无需等待加载
// ================================================================

// ================================================================
// 提示：使用 require() 直接引入包内 JSON（wx.getFileSystemManager
//       无权限读取代码包内的 /assets/ 文件，只能读取用户目录）。
// ================================================================
const PRODUCT_CONFIG = require('../../data/productConfig');


// ── 弹簧物理常量 ──
const RESISTANCE  = 0.28;   // 组边界阻力（0=完全不动，1=无阻力）
const DIST_THRESH = 80;     // 切换组所需最小位移 (px)
const VEL_THRESH  = 0.40;   // 切换组所需最小速度 (px/ms)

// ── CSS 过渡曲线 ──
const EASE_SPRING = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)'; // 弹回（含超调）
const EASE_SWITCH = 'transform 0.48s cubic-bezier(0.22,1,0.36,1)';    // 切组（流畅）
const EASE_FLING  = 'transform 0.50s cubic-bezier(0,0,0.2,1)';        // 惯性减速
const EASE_NONE   = 'none';                                            // 跟手，无过渡

Page({
  data: {
    // ── 来自 productConfig 的数据 ──
    groups:     [],   // 从配置加载后填充

    // ── 外层轨道（组切换） ──
    outerY:     0,
    outerEase:  EASE_NONE,

    // ── 各组内容偏移（按 gidx 索引的数组） ──
    groupY:     [],   // 每项 0 = 顶部，负值 = 已向下滚
    groupEase:  [],   // 每项的 CSS 过渡曲线

    // ── 状态 ──
    currentGroup: 0,
    springProg:   0,    // 弹簧进度 0~100
    springDir:    'next', // 'next'=向下一组, 'prev'=向上一组

    // ── 图片动画状态（key=imgId, value='initial'|'visible'|'exiting'） ──
    animMap:    {},
  },

  // ── 私有属性（不走 setData，避免无效渲染） ──
  _wH:             0,    // 屏幕高度 (px)
  _currentGroup:   0,    // 与 data.currentGroup 同步
  _groupMaxScroll: [],   // 各组最大内滚距离（测量后填充）

  // 当次触摸记录
  _activeGidx:       0,
  _touchStartY:      0,
  _touchStartTime:   0,
  _touchStartGroupY: 0,

  _observers: [],   // IntersectionObserver 实例，onUnload 时统一 disconnect

  // ================================================================
  //  onLoad：从配置初始化所有数据
  // ================================================================
  onLoad() {
    const sys = wx.getSystemInfoSync();
    this._wH = sys.windowHeight;

    // require() 在小程序中同步加载代码包内的 JSON，无需 fs.readFile
    const groups  = PRODUCT_CONFIG.groups;
    const nGroups = groups.length;

    const EASE_MAP = {
      'spring': 'cubic-bezier(0.34,1.56,0.64,1)',
      'ease': 'ease',
      'ease-out': 'ease-out',
      'linear': 'linear'
    };

    // 初始化 animMap：所有图片状态为 'initial'，并对数据做兼容与预处理
    const animMap = {};
    groups.forEach(g => g.images.forEach(img => { 
      animMap[img.id] = 'initial'; 
      img.overlays.forEach(ov => {
        // 向下兼容旧 JSON 数据
        if (!ov.pos) ov.pos = { x: 5, y: 15 };
        if (!ov.anim) {
          // 根据旧 dir 猜测
          let atype = 'slideX_right';
          if (ov.dir === 'left') atype = 'slideX_right';
          if (ov.dir === 'right') atype = 'slideX_left';
          if (ov.dir === 'bottom') atype = 'slideY';
          ov.anim = { type: atype, duration: 650, easing: 'spring', delay: 0 };
        }
        if (!ov.style) ov.style = { color: '#111111', fontSize: 28, fontWeight: '700', bgColor: 'rgba(255,255,255,0.93)', bgBlur: true, boxShadow: true };
        if (ov.style.boxShadow === undefined) ov.style.boxShadow = true;
        if (!ov.style.bgColor) ov.style.bgColor = 'transparent'; // 处理设为空/透明颜色的情况
        
        // 预计算 transition 注入到对象中供 WXML 渲染
        const dura = ov.anim.duration || 650;
        const dlay = ov.anim.delay || 0;
        const ease = EASE_MAP[ov.anim.easing] || 'ease';
        ov._transition = `transform ${dura}ms ${ease} ${dlay}ms, opacity ${dura}ms ease ${dlay}ms`;
      });
    }));

    this._groupMaxScroll = new Array(nGroups).fill(0);

    this.setData({
      groups,
      groupY:    new Array(nGroups).fill(0),
      groupEase: new Array(nGroups).fill(EASE_NONE),
      animMap,
    }, () => {
      // setData 回调表示数据已提交，但 DOM 渲染是异步的。
      // 延迟 600ms 再建立 Observer，确保所有图片节点已挂载；
      // 否则 observe() 找不到节点，visible 状态永远不触发（动画消失的根本原因）。
      const firstId = this.data.groups[0]?.images[0]?.id;
      if (firstId) setTimeout(() => this._setAnim(firstId, 'visible'), 400);
      setTimeout(() => {
        this._setupObservers();
        this._measureLayout();
      }, 600);
    });
  },

  // ================================================================
  //  onReady：DOM 已就绪，启动测量和观察
  // ================================================================
  onReady() {
    // onReady 不再处理 DOM 测量，因为我们要等 fs.readFile 异步数据读取完整并渲染完成后，再在 setData 的回调里开启
  },

  onUnload() {
    this._observers.forEach(o => o.disconnect());
  },

  // ================================================================
  //  _measureLayout：查询各组内容实际渲染高度
  //  id="gc-{gidx}" 对应 WXML 中的 group-content
  // ================================================================
  _measureLayout() {
    const q = this.createSelectorQuery();
    this.data.groups.forEach((_, i) => q.select(`#gc-${i}`).boundingClientRect());
    q.exec(rects => {
      if (rects.some(r => !r)) {
        // 尚未渲染完毕，延迟重试
        setTimeout(() => this._measureLayout(), 400);
        return;
      }
      rects.forEach((r, i) => {
        // maxScroll：内容超出视口的部分（等于组内可滚动距离）
        this._groupMaxScroll[i] = Math.max(0, r.height - this._wH);
      });
    });
  },

  // ================================================================
  //  _setupObservers：对每张图片设置 IntersectionObserver
  //
  //  两层 CSS transform（outerY + groupY）都会影响图片的视觉位置。
  //  在 WeChat Mini Program 中，IntersectionObserver 相对 .viewport
  //  能正确感知经过 transform 后的实际视觉交叉状态。
  //
  //  intersectionRatio >= 0.3 → 进入视口 → 'visible'（飞入）
  //  离开视口时判断方向：
  //    top > wH/2 → 图片在屏幕下方 → 用户往回滑 → 'exiting'（逆向退场）
  //    top < wH/2 → 图片在屏幕上方 → 已被滚过 → 'initial'（静默重置）
  // ================================================================
  _setupObservers() {
    this.data.groups.forEach(g => {
      g.images.forEach(img => {
        const obs = wx.createIntersectionObserver(this, { thresholds: [0, 0.3] });
        obs.relativeTo('.viewport').observe('#' + img.id, res => {
          if (res.intersectionRatio >= 0.3) {
            this._setAnim(img.id, 'visible');
          } else if (this.data.animMap[img.id] === 'visible') {
            const fromBelow = res.boundingClientRect.top > this._wH * 0.5;
            this._setAnim(img.id, fromBelow ? 'exiting' : 'initial');
            if (fromBelow) {
              // exiting 动画结束后重置为 initial（供下次重用）
              const id = img.id;
              setTimeout(() => {
                if (this.data.animMap[id] === 'exiting') this._setAnim(id, 'initial');
              }, 700);
            }
          }
        });
        this._observers.push(obs);
      });
    });
  },

  // 使用点路径做最小粒度 setData（只更新单个 key，不替换整个 animMap）
  _setAnim(id, state) {
    if (this.data.animMap[id] !== state) {
      this.setData({ [`animMap.${id}`]: state });
    }
  },

  // ================================================================
  //  通用触摸处理（onGStart / onGMove / onGEnd）
  //  所有组共用同一套逻辑，通过 data-gidx 区分当前操作的组
  // ================================================================

  // ── TouchStart：记录初始状态，停止所有进行中的过渡 ──
  onGStart(e) {
    const gidx = e.currentTarget.dataset.gidx;
    this._activeGidx       = gidx;
    this._touchStartY      = e.touches[0].clientY;
    this._touchStartTime   = Date.now();
    this._touchStartGroupY = this.data.groupY[gidx];

    // 停止进行中的 CSS 过渡，让内容立即跟手
    const newGroupEase = [...this.data.groupEase];
    newGroupEase[gidx] = EASE_NONE;
    this.setData({ groupEase: newGroupEase, outerEase: EASE_NONE });
  },

  // ── TouchMove：根据位置决定组内滚动还是弹簧位移 ──
  onGMove(e) {
    const gidx     = this._activeGidx;
    const rawDelta = e.touches[0].clientY - this._touchStartY;
    // rawDelta > 0: 手指向下（内容上移 = 看上方内容 = 往回）
    // rawDelta < 0: 手指向上（内容下移 = 看下方内容 = 往前）
    const newGY    = this._touchStartGroupY + rawDelta;

    const innerMax = 0;
    const innerMin = -(this._groupMaxScroll[gidx] || 0); // ≤ 0
    // 当内容比屏幕短时 innerMin=0，任何向前拖都立即进入弹簧区

    const baseOuterY = -gidx * this._wH; // 当前组"标准"的 outerY
    const nGroups    = this.data.groups.length;
    const newGroupY  = [...this.data.groupY];

    if (newGY > innerMax) {
      // ① 超过顶部边界
      if (gidx > 0) {
        // 向上弹簧：outerY 从 baseOuterY 向 -(gidx-1)*wH 位移
        const overscroll = newGY; // 正值
        const springY    = baseOuterY + overscroll * RESISTANCE;
        const prog       = Math.min(100, Math.round(overscroll / DIST_THRESH * 100));
        newGroupY[gidx]  = innerMax;
        this.setData({ groupY: newGroupY, outerY: springY, springProg: prog, springDir: 'prev' });
      } else {
        // 第一组，无上一组，夹住
        newGroupY[gidx] = innerMax;
        this.setData({ groupY: newGroupY, outerY: baseOuterY, springProg: 0 });
      }

    } else if (newGY < innerMin) {
      // ② 超过底部边界
      if (gidx < nGroups - 1) {
        // 向下弹簧：outerY 从 baseOuterY 向 -(gidx+1)*wH 位移
        const overscroll = newGY - innerMin; // 负值
        const springY    = baseOuterY + overscroll * RESISTANCE; // 向更负方向移动
        const prog       = Math.min(100, Math.round(Math.abs(overscroll) / DIST_THRESH * 100));
        newGroupY[gidx]  = innerMin;
        this.setData({ groupY: newGroupY, outerY: springY, springProg: prog, springDir: 'next' });
      } else {
        // 最后一组，无下一组，夹住
        newGroupY[gidx] = innerMin;
        this.setData({ groupY: newGroupY, outerY: baseOuterY, springProg: 0 });
      }

    } else {
      // ③ 正常组内滚动
      newGroupY[gidx] = newGY;
      this.setData({ groupY: newGroupY, outerY: baseOuterY, springProg: 0 });
    }
  },

  // ── TouchEnd：判断弹回 / 切组 / 惯性 ──
  onGEnd(e) {
    const gidx       = this._activeGidx;
    const delta      = e.changedTouches[0].clientY - this._touchStartY;
    const dt         = Math.max(1, Date.now() - this._touchStartTime);
    const vel        = delta / dt; // px/ms，正=向下，负=向上
    const baseOuterY = -gidx * this._wH;
    const nGroups    = this.data.groups.length;

    this.setData({ springProg: 0 });

    // outerDiff：outerY 与当前组标准位置的差值（非 0 说明在弹簧区）
    const outerDiff = this.data.outerY - baseOuterY;

    if (outerDiff < -8) {
      // 在"向下一组"弹簧区（outerY 比标准更负）
      const hasForce = delta < -DIST_THRESH || vel < -VEL_THRESH; // 手指向上且力量充足
      if (hasForce && gidx < nGroups - 1) {
        this._switchGroup(gidx, gidx + 1);
      } else {
        // 弹回：EASE_SPRING 超调曲线
        this.setData({ outerY: baseOuterY, outerEase: EASE_SPRING });
        setTimeout(() => this.setData({ outerEase: EASE_NONE }), 600);
      }

    } else if (outerDiff > 8) {
      // 在"向上一组"弹簧区（outerY 比标准更正）
      const hasForce = delta > DIST_THRESH || vel > VEL_THRESH; // 手指向下且力量充足
      if (hasForce && gidx > 0) {
        this._switchGroup(gidx, gidx - 1);
      } else {
        this.setData({ outerY: baseOuterY, outerEase: EASE_SPRING });
        setTimeout(() => this.setData({ outerEase: EASE_NONE }), 600);
      }

    } else {
      // 正常组内惯性：vel * 衰减时间 估算终点
      const innerMin    = -(this._groupMaxScroll[gidx] || 0);
      const flingTarget = this.data.groupY[gidx] + vel * 220; // 220ms 惯性估算
      const clamped     = Math.max(innerMin, Math.min(0, flingTarget));

      const newGroupY   = [...this.data.groupY];
      const newGroupEase = [...this.data.groupEase];
      newGroupY[gidx]   = clamped;
      newGroupEase[gidx] = EASE_FLING;
      this.setData({ groupY: newGroupY, groupEase: newGroupEase });

      // 过渡结束后清除 ease（防止下次 JS 更新触发多余动画）
      setTimeout(() => {
        const resetEase = [...this.data.groupEase];
        resetEase[gidx] = EASE_NONE;
        this.setData({ groupEase: resetEase });
      }, 550);
    }
  },

  // ================================================================
  //  _switchGroup：执行组切换动画
  //
  //  · 向后（to > from）：目标组 groupY 重置为 0（从顶部开始浏览）
  //  · 向前（to < from）：目标组 groupY 保留（用户返回到离开时的位置）
  //  · 两组始终在 DOM 中，无需等待渲染，彻底消除黑屏
  // ================================================================
  _switchGroup(from, to) {
    const targetOuterY  = -to * this._wH;
    const newGroupY     = [...this.data.groupY];
    const newGroupEase  = [...this.data.groupEase];

    if (to > from) {
      // 向下进入新组：重置目标组到顶部，确保用户从头浏览
      newGroupY[to]    = 0;
      newGroupEase[to] = EASE_NONE;
    }
    // 向上返回旧组：保留 groupY（用户回到离开时的滚动位置）

    this.setData({
      outerY:     targetOuterY,
      outerEase:  EASE_SWITCH,
      currentGroup: to,
      groupY:     newGroupY,
      groupEase:  newGroupEase,
    });
    this._currentGroup = to;

    // 过渡结束后清除 outerEase
    setTimeout(() => this.setData({ outerEase: EASE_NONE }), 520);
  },
});
