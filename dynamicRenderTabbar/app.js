const { ALL_TABS } = require('./utils/tab-constants');
const { fetchRuntimeTabConfig } = require('./utils/runtime-config');

App({
  globalData: {
    allTabs: ALL_TABS,
    visibleTabCount: 3,
    runtimeConfigReady: false
  },

  onLaunch() {
    fetchRuntimeTabConfig().then((config) => {
      this.globalData.visibleTabCount = config.visibleTabCount;
      this.globalData.runtimeConfigReady = true;
    });
  }
});
