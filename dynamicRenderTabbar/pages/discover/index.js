const { syncCurrentTab } = require('../../utils/tabbar-helper');

Page({
  onShow() {
    syncCurrentTab(this);
  }
});
