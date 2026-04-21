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
      const sourceTabs = allTabs.slice(0, count);
      const shapeMode = count % 2 === 1 && count >= 3 ? 'floating' : 'flat';
      const centerIndex = shapeMode === 'floating' ? Math.floor(count / 2) : -1;

      const visibleTabs = sourceTabs.map((item, index) => {
        const fullPath = `/${item.pagePath}`;
        const isCenter = index === centerIndex;
        return {
          pagePath: item.pagePath,
          text: item.text,
          fullPath,
          isCenter,
          tapPath: isCenter && shapeMode === 'floating' ? '' : fullPath
        };
      });

      const centerSource = centerIndex >= 0 ? sourceTabs[centerIndex] : null;
      const centerTab = centerSource
        ? {
            pagePath: centerSource.pagePath,
            text: centerSource.text,
            fullPath: `/${centerSource.pagePath}`,
            glyph: String(centerSource.text || 'C').slice(0, 1).toUpperCase()
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