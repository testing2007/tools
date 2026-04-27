Component({
  data: {
    selectedPath: '',
    visibleTabs: [],
    shapeMode: 'flat',
    tabsSignature: '',
    centerTab: null
  },

  lifetimes: {
    attached() {
      this.applyRuntimeConfig();
    }
  },

  methods: {
    applyRuntimeConfig() {
      const app = getApp ? getApp() : null;
      const globalData = (app && app.globalData) || {};
      const allTabs = globalData.allTabs || [];
      const count = globalData.visibleTabCount || 3;
      // 运行时只渲染前 N 个 tab，保留 app.json 里的完整 tabBar 注册能力。
      const sourceTabs = allTabs.slice(0, count);
      const shapeMode = count % 2 === 1 && count >= 3 ? 'floating' : 'flat';
      const centerIndex = shapeMode === 'floating' ? Math.floor(count / 2) : -1;

      const visibleTabs = sourceTabs.map((item, index) => {
        const fullPath = `/${item.pagePath}`;
        const isCenter = index === centerIndex;
        return {
          pagePath: item.pagePath,
          text: item.text,
          iconType: item.iconType || 'dot',
          fullPath,
          isCenter,
          tapPath: isCenter && shapeMode === 'floating' ? '' : fullPath
        };
      });

      const centerSource = centerIndex >= 0 ? sourceTabs[centerIndex] : null;
      // 奇数 tab 时把中间项抽成悬浮按钮，形成“轻微突出 tabbar”的视觉焦点。
      const centerTab = centerSource
        ? {
            pagePath: centerSource.pagePath,
            text: centerSource.text,
            iconType: centerSource.iconType || 'dot',
            fullPath: `/${centerSource.pagePath}`
          }
        : null;

      const tabsSignature = `${shapeMode}|${visibleTabs.map((item) => item.pagePath).join('|')}`;
      if (this.data.tabsSignature === tabsSignature) {
        return;
      }

      this.setData({
        visibleTabs,
        shapeMode,
        tabsSignature,
        centerTab
      });
    },

    setCurrentByRoute(route) {
      this.applyRuntimeConfig();
      const fullPath = `/${route}`;
      if (this.data.selectedPath === fullPath) {
        return;
      }
      this.setData({ selectedPath: fullPath });
    },

    onTabTap(event) {
      const path = event.currentTarget.dataset.path;
      if (!path || path === this.data.selectedPath) {
        return;
      }
      wx.switchTab({
        url: path
      });
    }
  }
});
