// ================================================================
// index.js  v4  ——  Custom Touch Physics Engine
//
// 架构：完全自定义触摸物理，替代 scroll-view 原生滚动
//
// 核心机制：
//  1. 【轨道坐标系】
//     trackY = 0                → 显示 Slide 0
//     trackY = -1 * windowH    → 显示 Slide 1
//     trackY = -N * windowH    → 显示 Slide N
//
//  2. 【组边界阻力（Spring Resistance）】
//     当触摸试图越过组边界（slide 2→3 或 3→4）时：
//       · 施加 RESISTANCE_FACTOR 阻力（手指位移 * 0.25 = 实际移动量）
//       · 过渡屏的底部进度条显示当前"闯关进度"
//
//  3. 【弹簧弹回（Spring Back）】
//     释放手指时：
//       · 力量不足 → cubic-bezier(0.34, 1.56, 0.64, 1) 超调弹回
//         （内容先继续向目标方向移动约 10%，再弹回，形成弹簧感）
//       · 力量足够 → cubic-bezier(0.22, 1, 0.36, 1) 平滑穿越
//
//  4. 【浮层动画三态状态机】
//     向前滑（新 slide 入场）:  新 slide → 'visible'，旧 slide → 'initial'
//     向回滑（逆向）         :  新 slide → 'visible'，旧 slide → 'exiting'（逆向退场）
//     退场动画结束后          :  'exiting' → 'initial' 静默重置
// ================================================================

// ── 物理常量 ──
const RESISTANCE_FACTOR  = 0.25;  // 组边界阻力系数：0=完全不动，1=无阻力
const DIST_THRESH_NORMAL = 50;    // 普通 slide 切换：最小位移(px)
const DIST_THRESH_BORDER = 100;   // 组边界切换：最小位移(px)，更高门槛
const VEL_THRESH_NORMAL  = 0.35;  // 普通 slide：最小速度(px/ms)
const VEL_THRESH_BORDER  = 0.6;   // 组边界：最小速度(px/ms)，更高门槛

// ── 动画曲线 ──
const EASE_SPRING_BACK = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 弹簧弹回（有超调）
const EASE_CROSS_BORDER= 'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)';    // 越过组边界（流畅重量感）
const EASE_NORMAL_SNAP = 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // 普通换页
const EASE_NONE        = 'none';

// ── Slide 数据索引 ──
const TRANSITION_IDX = 3;  // 组过渡屏在 slides 数组中的位置
const TOTAL_SLIDES   = 7;  // 0~6
const IMAGE_INDICES  = new Set([0, 1, 2, 4, 5, 6]);

// 是否为组边界穿越（此时触发阻力 + 高门槛）
function isGroupBoundaryCrossing(currentSlide, deltaY) {
  // deltaY < 0 → finger moved UP → content going to higher-index slides (forward)
  // deltaY > 0 → finger moved DOWN → content going to lower-index slides (backward)
  const goingForward  = deltaY < 0;
  const goingBackward = deltaY > 0;
  return (
    (currentSlide === 2 && goingForward)  ||   // 2→3 进入过渡屏
    (currentSlide === TRANSITION_IDX)     ||   // 过渡屏两侧均有阻力
    (currentSlide === 4 && goingBackward)      // 4→3 从 Group2 退回过渡屏
  );
}

// 两个 slide 之间是否跨越了组边界（用于决定动画曲线）
function isCrossingGroupBorder(from, to) {
  return (
    (from <= 2 && to >= TRANSITION_IDX) ||
    (from >= TRANSITION_IDX && to <= 2) ||
    (from <= TRANSITION_IDX && to >= 4) ||
    (from >= 4 && to <= TRANSITION_IDX)
  );
}

Page({
  data: {
    slides: [
      // ════ GROUP 1 ════
      {
        type: 'image', src: '../../assets/01.jpg',
        overlayType: 'tag', pos: 'top-left', dir: 'left',
        icon: '✨', label: '全新登场',
        state: 'initial', badge: '01 / 06',
      },
      {
        type: 'image', src: '../../assets/02.jpg',
        overlayType: 'card', pos: 'mid-right', dir: 'right',
        cardTitle: '震撼视觉', cardDesc: '超越以往的美学方案，带来极致体验',
        state: 'initial', badge: '02 / 06',
      },
      {
        type: 'image', src: '../../assets/03.jpg',
        overlayType: 'tag', pos: 'bot-center', dir: 'bottom',
        icon: '🚀', label: '性能狂飙',
        state: 'initial', badge: '03 / 06',
      },

      // ════ 组间过渡屏 ════
      {
        type: 'transition',
        eyebrow: 'CHAPTER · 02',
        title: '非凡工艺',
        desc: '每一处细节，都是我们的承诺',
      },

      // ════ GROUP 2 ════
      {
        type: 'image', src: '../../assets/04.jpg',
        overlayType: 'card', pos: 'mid-left', dir: 'left',
        cardTitle: '坚若磐石', cardDesc: '创新材料架构，经久耐用',
        state: 'initial', badge: '04 / 06',
      },
      {
        type: 'image', src: '../../assets/05.jpg',
        overlayType: 'tag', pos: 'top-right', dir: 'right',
        icon: '🔋', label: '持久续航',
        state: 'initial', badge: '05 / 06',
      },
      {
        type: 'image', src: '../../assets/06.jpg',
        overlayType: 'main-card', pos: 'bot-center', dir: 'bottom',
        cardTitle: '立即体验', cardDesc: '感受更多不凡之处',
        state: 'initial', badge: '06 / 06',
      },
    ],

    trackY:           0,        // 轨道当前 Y 坐标
    trackTransition:  EASE_NONE,// 当前动画曲线（拖动时=none，弹回时=spring等）
    currentSlide:     0,        // 当前停靠的 slide 下标 (0~6)
    transitionPressure: 0,      // 过渡屏进度条（0~100），显示越过门槛的进度
    groupLabelVisible: false,
    groupLabels: ['春夏系列', '秋冬系列'],
  },

  // ── 私有变量（不放 data，避免触发不必要的 setData）──
  _wH:              0,    // 缓存 windowHeight
  _touchStartY:     0,    // 触摸开始时的 clientY
  _touchStartTime:  0,    // 触摸开始时的时间戳
  _touchStartTrackY:0,    // 触摸开始时的 trackY
  _currentSlide:    0,    // 当前 slide（与 data.currentSlide 同步，用于逻辑计算）
  _labelTimer:      null, // 顶部标签定时器

  // ================================================================
  onLoad() {
    const sys = wx.getSystemInfoSync();
    this._wH = sys.windowHeight;
  },

  onReady() {
    // 初始激活第一张图片的浮层动画
    this._activateSlide(0, -1, 'forward');
  },

  onUnload() {
    if (this._labelTimer) clearTimeout(this._labelTimer);
  },

  // ================================================================
  // 触摸开始：记录初始状态，关闭轨道 transition
  // ================================================================
  onTouchStart(e) {
    this._touchStartY      = e.touches[0].clientY;
    this._touchStartTime   = Date.now();
    this._touchStartTrackY = this.data.trackY;

    // 拖动期间关闭 CSS transition（让内容跟随手指实时移动）
    if (this.data.trackTransition !== EASE_NONE) {
      this.setData({ trackTransition: EASE_NONE });
    }
  },

  // ================================================================
  // 触摸移动：实时更新轨道位置，组边界施加阻力
  // ================================================================
  onTouchMove(e) {
    const currentY = e.touches[0].clientY;
    const rawDelta = currentY - this._touchStartY; // 正=向下拖，负=向上拖

    // 判断是否在组边界处（决定是否施加阻力）
    const atBorder = isGroupBoundaryCrossing(this._currentSlide, rawDelta);
    const appliedDelta = atBorder ? rawDelta * RESISTANCE_FACTOR : rawDelta;

    let newTrackY = this._touchStartTrackY + appliedDelta;

    // 边界钳制（顶部/底部各允许 60px 的过拉）
    const minY = -(TOTAL_SLIDES - 1) * this._wH - 60;
    const maxY = 60;
    newTrackY = Math.min(maxY, Math.max(minY, newTrackY));

    // 更新轨道位置
    this.setData({ trackY: newTrackY });

    // 若停在过渡屏上，实时计算并显示"闯关进度条"
    if (this._currentSlide === TRANSITION_IDX && atBorder) {
      const dist = Math.abs(rawDelta);
      const pressure = Math.min(100, Math.round(dist / DIST_THRESH_BORDER * 100));
      if (pressure !== this.data.transitionPressure) {
        this.setData({ transitionPressure: pressure });
      }
    }
  },

  // ================================================================
  // 触摸结束：计算速度，决定弹簧弹回还是换页
  // ================================================================
  onTouchEnd(e) {
    const endY   = e.changedTouches[0].clientY;
    const totalDelta = endY - this._touchStartY;   // 正=向下，负=向上
    const dt         = Math.max(1, Date.now() - this._touchStartTime);
    const velocity   = totalDelta / dt;            // px/ms，正=向下

    const atBorder = isGroupBoundaryCrossing(this._currentSlide, totalDelta);

    // 组边界使用更高的切换门槛
    const distThresh = atBorder ? DIST_THRESH_BORDER : DIST_THRESH_NORMAL;
    const velThresh  = atBorder ? VEL_THRESH_BORDER  : VEL_THRESH_NORMAL;

    let targetSlide = this._currentSlide;

    if (totalDelta < -distThresh || velocity < -velThresh) {
      // 向上滑动（充分）→ 进入下一 slide（更高索引）
      targetSlide = Math.min(this._currentSlide + 1, TOTAL_SLIDES - 1);
    } else if (totalDelta > distThresh || velocity > velThresh) {
      // 向下滑动（充分）→ 回到上一 slide（更低索引）
      targetSlide = Math.max(this._currentSlide - 1, 0);
    }
    // else：力量不足 → targetSlide 保持不变（弹回当前 slide）

    const isSpringBack = (targetSlide === this._currentSlide);
    this._snapToSlide(targetSlide, isSpringBack);

    // 清除进度条
    if (this.data.transitionPressure > 0) {
      this.setData({ transitionPressure: 0 });
    }
  },

  // ================================================================
  // 吸附到目标 slide，并播放对应动画曲线
  //   · isSpringBack=true  → 弹簧弹回（超调曲线）
  //   · 穿越组边界         → 流畅重量感曲线
  //   · 普通换页           → 快速吸附曲线
  // ================================================================
  _snapToSlide(targetSlide, isSpringBack) {
    const oldSlide  = this._currentSlide;
    const targetY   = -targetSlide * this._wH;
    const direction = targetSlide > oldSlide ? 'forward' : 'backward';

    let ease;
    if (isSpringBack) {
      ease = EASE_SPRING_BACK;
    } else if (isCrossingGroupBorder(oldSlide, targetSlide)) {
      ease = EASE_CROSS_BORDER;
    } else {
      ease = EASE_NORMAL_SNAP;
    }

    this.setData({
      trackY: targetY,
      trackTransition: ease,
      currentSlide: targetSlide,
    });

    this._currentSlide = targetSlide;

    // 更新浮层动画状态（只在真正切换 slide 时）
    if (!isSpringBack) {
      this._activateSlide(targetSlide, oldSlide, direction);
    }

    // 更新顶部分组标签
    if (!isSpringBack && targetSlide !== oldSlide && targetSlide !== TRANSITION_IDX) {
      this._showGroupLabel();
    }
  },

  // ================================================================
  // 更新浮层动画三态状态机
  //   · 新 slide 进入 → 'visible'（触发飞入动画）
  //   · 旧 slide 向前退出 → 'initial'（静默重置）
  //   · 旧 slide 向回退出 → 'exiting'（触发逆向退场动画），700ms后重置
  // ================================================================
  _activateSlide(newSlide, oldSlide, direction) {
    const updates = {};

    // 激活新 slide 的浮层
    if (IMAGE_INDICES.has(newSlide)) {
      updates[`slides[${newSlide}].state`] = 'visible';
    }

    // 退出旧 slide 的浮层
    if (oldSlide >= 0 && IMAGE_INDICES.has(oldSlide) && oldSlide !== newSlide) {
      // 向回滑时：旧 slide 逆向退出（exiting）
      // 向前滑时：旧 slide 静默重置（initial）
      const exitState = direction === 'backward' ? 'exiting' : 'initial';
      updates[`slides[${oldSlide}].state`] = exitState;

      if (exitState === 'exiting') {
        // 退场动画（0.65s）结束后，静默重置为 initial，以便下次再次飞入
        const capturedIdx = oldSlide;
        setTimeout(() => {
          if (this.data.slides[capturedIdx] &&
              this.data.slides[capturedIdx].state === 'exiting') {
            this.setData({ [`slides[${capturedIdx}].state`]: 'initial' });
          }
        }, 750);
      }
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates);
    }
  },

  // ================================================================
  // 顶部分组标签：短暂显示后淡出
  // ================================================================
  _showGroupLabel() {
    if (this._labelTimer) clearTimeout(this._labelTimer);
    this.setData({ groupLabelVisible: true });
    this._labelTimer = setTimeout(() => {
      this.setData({ groupLabelVisible: false });
    }, 2000);
  },
});
