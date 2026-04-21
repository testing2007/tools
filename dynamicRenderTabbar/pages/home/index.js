const { saveRuntimeTabCount } = require('../../utils/runtime-config');
const { syncCurrentTab } = require('../../utils/tabbar-helper');

function buildHomeFeed() {
  return Array.from({ length: 36 }, (_, idx) => {
    const n = idx + 1;
    return {
      id: `feed-${n}`,
      title: `Home Feed Block ${n}`,
      desc: `Scroll test content item ${n}. Switch tab and come back to verify state retention.`,
      tag: n % 2 === 0 ? 'Long List' : 'State Test'
    };
  });
}

Page({
  data: {
    visibleTabCount: 3,
    feedItems: buildHomeFeed(),
    feedScrollTop: 0,
    scrollSnapshot: 0
  },

  onShow() {
    const app = getApp();
    this.setData({
      visibleTabCount: app.globalData.visibleTabCount || 3,
      feedScrollTop: this._feedScrollTop || 0
    });
    syncCurrentTab(this);
  },

  onFeedScroll(event) {
    const top = Math.floor(event.detail.scrollTop || 0);
    this._feedScrollTop = top;

    if (Math.abs(top - this.data.scrollSnapshot) >= 80) {
      this.setData({
        scrollSnapshot: top
      });
    }
  },

  setTabCount(event) {
    const value = Number(event.currentTarget.dataset.count);
    const visibleTabCount = saveRuntimeTabCount(value);
    const app = getApp();
    if (app.globalData.visibleTabCount === visibleTabCount) {
      return;
    }
    app.globalData.visibleTabCount = visibleTabCount;

    this.setData({ visibleTabCount });
    const tabBar = this.getTabBar();
    if (tabBar && typeof tabBar.applyRuntimeConfig === 'function') {
      tabBar.applyRuntimeConfig();
      tabBar.setCurrentByRoute(this.route);
    }

    wx.showToast({
      title: `Visible tabs: ${visibleTabCount}`,
      icon: 'none'
    });
  },

  gotoDetail() {
    wx.navigateTo({
      url: '/pages/detail/index'
    });
  }
});