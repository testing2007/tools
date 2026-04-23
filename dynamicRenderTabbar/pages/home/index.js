var runtimeConfig = require('../../utils/runtime-config');
var tabbarHelper  = require('../../utils/tabbar-helper');
var saveRuntimeTabCount = runtimeConfig.saveRuntimeTabCount;
var syncCurrentTab      = tabbarHelper.syncCurrentTab;

// ═══════════════════════════════════════════════════
//  Config（后续可由后台配置编辑器注入）
// ═══════════════════════════════════════════════════
var CONFIG = {
  slideCount:     2,
  autoInterval:   3600,  // ms
  stageRpx:       702,   // hero-stage 宽度 rpx（750 - 24*2）
  flipDuration:   600,   // ms，翻页过场
  springDuration: 420,   // ms，弹回
  velocityBoost:  2.0,   // 速度对触发分数的贡献系数
  scoreTrigger:   0.5    // 综合阈值；超出则触发翻页
};

// ═══════════════════════════════════════════════════
//  RPX ↔ PX（缓存，避免重复调用 getSystemInfoSync）
// ═══════════════════════════════════════════════════
var _rpxRatio = 0;
function getRpxRatio() {
  if (!_rpxRatio) { _rpxRatio = wx.getSystemInfoSync().windowWidth / 750; }
  return _rpxRatio;
}
// px → rpx
function pxToRpx(px) { return px / getRpxRatio(); }
// 702rpx → px（stage 物理宽度）
function stageWidthPx() { return Math.round(CONFIG.stageRpx * getRpxRatio()); }

// ═══════════════════════════════════════════════════
//  Feed 数据
// ═══════════════════════════════════════════════════
function buildHomeFeed() {
  var out = [];
  for (var i = 0; i < 12; i++) {
    out.push({
      id:    'feed-' + (i + 1),
      title: 'Home Feed Block ' + (i + 1),
      desc:  'Scroll test content ' + (i + 1) + '. Switch tab and come back.',
      tag:   (i + 1) % 2 === 0 ? 'Long List' : 'State Test'
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════
Page({
  data: {
    visibleTabCount: 3,
    feedItems:       buildHomeFeed(),
    scrollSnapshot:  1,
    activeSlide:     0,

    // WXS 需要从 dataset 读取的值
    isAnimating:   false,   // WXS 据此决定是否响应新的 touch
    stageWidthPx:  351,     // WXS 据此限制拖拽距离（px）
    clearVersion:  0,       // 每次递增触发 WXS onClear，清除 inline style

    // 底图：DOM 顺序决定层叠；只控制 under1 的 opacity
    // under1Opacity=0 → 显示 slide0；=1 → 显示 slide1
    under1Opacity: 0,
    under1Trans:   '',      // '' 或 'fade-600'

    // 浮层 wrapper（#float0w / #float1w）的 transform + 过渡类
    // WXS 在拖拽时直接 setStyle(transform)；JS 在动画时通过 setData 控制
    float0X:     0,
    float0Trans: '',        // '' | 'trans-none' | 'trans-flip' | 'trans-spring'
    float0Opacity: 1,

    float1X:     0,
    float1Trans: '',
    float1Opacity: 0
  },

  // ── 私有状态（不进 setData） ───────────────────────
  _animating:     false,
  _touchStartTime: 0,
  _heroTimer:     null,
  _timers:        [],     // 所有动画 setTimeout ID

  // ══════════════════════════════════════════════════
  //  Lifecycle
  // ══════════════════════════════════════════════════
  onShow: function() {
    var app = getApp();
    this.setData({
      visibleTabCount: app.globalData.visibleTabCount || 3,
      stageWidthPx:    stageWidthPx()
    });
    syncCurrentTab(this);
    this._startAutoLoop();
  },

  onHide:   function() { this._stopAutoLoop(); this._clearTimers(); },
  onUnload: function() { this._stopAutoLoop(); this._clearTimers(); },

  // ══════════════════════════════════════════════════
  //  WXS 回调（由 callMethod 触发，在 JS 线程执行）
  // ══════════════════════════════════════════════════

  // WXS touchStart → JS：停止自动轮播，记录开始时间
  onWxsStart: function() {
    this._stopAutoLoop();
    this._clearTimers();
    this._animating      = false;
    this._touchStartTime = Date.now();
  },

  // WXS touchEnd → JS：计算手势，决定翻页或弹回
  onWxsEnd: function(data) {
    var totalDxPx = data.totalDxPx || 0;
    var lastDxPx  = data.lastDxPx  || 0;
    var dt        = Math.max(Date.now() - this._touchStartTime, 50);

    // 几乎未移动（轻点）：直接重启轮播，跳过动画
    if (Math.abs(lastDxPx) < 5) {
      this._startAutoLoop();
      return;
    }

    // 计算综合触发分数
    var velocity  = totalDxPx / dt;                           // px/ms
    var normDist  = Math.abs(totalDxPx) / stageWidthPx();
    var velScore  = Math.abs(velocity) * CONFIG.velocityBoost;
    var score     = normDist + velScore;

    var cur     = this.data.activeSlide;
    var flipDir = totalDxPx < 0 ? 1 : -1;                   // 1=前进 -1=后退
    var lastRpx = pxToRpx(lastDxPx);                        // WXS 用 px，WXML 用 rpx

    // 同步 WXML 数据位置 = WXS 当前 inline style 位置，同时触发 WXS 清除
    // 这样 WXS clear 后 WXML 接管时位置不跳变
    var sync = {};
    sync['float' + cur + 'X']     = +lastRpx.toFixed(1);
    sync['float' + cur + 'Trans'] = 'trans-none'; // 不触发 CSS 过渡，直接到位
    sync.clearVersion              = this.data.clearVersion + 1;
    this.setData(sync);

    // 等一帧：确保渲染线程已处理 WXML 复位 + WXS 清除完成
    var self = this;
    var t = setTimeout(function() {
      if (score >= CONFIG.scoreTrigger) {
        var next = (cur + flipDir + CONFIG.slideCount) % CONFIG.slideCount;
        self._commitFlip(cur, next, flipDir);
      } else {
        self._springBack(cur);
      }
      self._startAutoLoop();
    }, 16);
    this._timers.push(t);
  },

  // ══════════════════════════════════════════════════
  //  翻页动画（CSS transition 驱动，无 JS 帧循环）
  //
  //  分两步保证 CSS transition 正确触发：
  //  Step-A: 将"进入侧"瞬间定位到起始位置（trans-none）
  //          同时为"离开侧"挂上过渡类
  //  Step-B（等 1 帧后）: 为"进入侧"挂上过渡类，再修改双方位置
  //          浏览器在上一帧已提交了进入侧的起始值，过渡必然触发
  // ══════════════════════════════════════════════════
  _commitFlip: function(current, next, dir) {
    if (this._animating) { return; }
    this._animating = true;
    this.setData({ isAnimating: true });

    var stageRpx = CONFIG.stageRpx;
    var exitRpx  = dir === 1 ? -stageRpx :  stageRpx;  // 当前 → 飞出方向
    var enterRpx = dir === 1 ?  stageRpx : -stageRpx;  // 下一个 ← 进入方向
    var underEnd = next === 1 ? 1 : 0;

    var self = this;

    // ── Step-A ──────────────────────────────────────
    var stepA = {};
    stepA['float' + next    + 'X']       = enterRpx;   // 瞬间到起点
    stepA['float' + next    + 'Opacity'] = 1;
    stepA['float' + next    + 'Trans']   = 'trans-none';// 不过渡
    stepA['float' + current + 'Trans']   = 'trans-flip';// 离开侧就绪
    stepA['under1Trans']                  = 'fade-600'; // 底图过渡就绪
    this.setData(stepA);

    // ── Step-B（1 帧后）：激活进入侧过渡，启动所有动画 ─
    var t1 = setTimeout(function() {
      var stepB = {};
      stepB['float' + next    + 'Trans']   = 'trans-flip';// 进入侧激活
      stepB['float' + current + 'X']       = exitRpx;    // 离开（已有过渡）
      stepB['float' + next    + 'X']       = 0;          // 进入（从 enterRpx → 0）
      stepB['under1Opacity']               = underEnd;   // 底图淡入/淡出
      self.setData(stepB);

      // ── 清场（过渡结束后）──────────────────────────
      var t2 = setTimeout(function() {
        var cleanup = {};
        cleanup['float' + current + 'Opacity'] = 0;
        cleanup['float' + current + 'X']       = 0;
        cleanup['float' + current + 'Trans']   = '';
        cleanup['float' + next    + 'X']       = 0;
        cleanup['float' + next    + 'Trans']   = '';
        cleanup.under1Trans                     = '';
        cleanup.activeSlide                     = next;
        cleanup.scrollSnapshot                  = next + 1;
        cleanup.isAnimating                     = false;
        self.setData(cleanup);
        self._animating = false;
      }, CONFIG.flipDuration + 100);
      self._timers.push(t2);

    }, 16); // 等 1 帧让 Step-A 渲染完成
    this._timers.push(t1);
  },

  // ══════════════════════════════════════════════════
  //  弹回动画（CSS transition，easeOutBack 曲线）
  //  同样分两步确保过渡触发
  // ══════════════════════════════════════════════════
  _springBack: function(current) {
    this._animating = true;
    this.setData({ isAnimating: true });

    var self = this;

    // Step-A：仅挂上弹簧过渡类，不改变 X（X 仍在 onWxsEnd sync 的位置）
    var stepA = {};
    stepA['float' + current + 'Trans'] = 'trans-spring';
    this.setData(stepA);

    // Step-B（1 帧后）：修改 X → 0，过渡触发
    var t1 = setTimeout(function() {
      self.setData({ ['float' + current + 'X']: 0 });

      var t2 = setTimeout(function() {
        var cleanup = {};
        cleanup['float' + current + 'Trans'] = '';
        cleanup.isAnimating                   = false;
        self.setData(cleanup);
        self._animating = false;
      }, CONFIG.springDuration + 100);
      self._timers.push(t2);

    }, 16);
    this._timers.push(t1);
  },

  // ══════════════════════════════════════════════════
  //  自动轮播
  // ══════════════════════════════════════════════════
  _startAutoLoop: function() {
    this._stopAutoLoop();
    var self = this;
    this._heroTimer = setInterval(function() {
      if (self._animating) { return; }
      var cur  = self.data.activeSlide;
      var next = (cur + 1) % CONFIG.slideCount;
      self._commitFlip(cur, next, 1);
    }, CONFIG.autoInterval);
  },

  _stopAutoLoop: function() {
    if (this._heroTimer) { clearInterval(this._heroTimer); this._heroTimer = null; }
  },

  // ══════════════════════════════════════════════════
  //  Timer 管理
  // ══════════════════════════════════════════════════
  _clearTimers: function() {
    for (var i = 0; i < this._timers.length; i++) {
      clearTimeout(this._timers[i]);
    }
    this._timers = [];
    this._animating = false;
  },

  // ══════════════════════════════════════════════════
  //  Tab 工具
  // ══════════════════════════════════════════════════
  setTabCount: function(event) {
    var value = Number(event.currentTarget.dataset.count);
    var visibleTabCount = saveRuntimeTabCount(value);
    var app = getApp();
    if (app.globalData.visibleTabCount === visibleTabCount) { return; }
    app.globalData.visibleTabCount = visibleTabCount;
    this.setData({ visibleTabCount: visibleTabCount });
    var tabBar = this.getTabBar();
    if (tabBar && typeof tabBar.applyRuntimeConfig === 'function') {
      tabBar.applyRuntimeConfig();
      tabBar.setCurrentByRoute(this.route);
    }
    wx.showToast({ title: 'Visible tabs: ' + visibleTabCount, icon: 'none' });
  },

  gotoDetail: function() {
    wx.navigateTo({ url: '/pages/detail/index' });
  }
});
