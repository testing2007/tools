function syncCurrentTab(pageInstance) {
  if (!pageInstance || typeof pageInstance.getTabBar !== 'function') {
    return;
  }

  const tabBar = pageInstance.getTabBar();
  if (!tabBar || typeof tabBar.setCurrentByRoute !== 'function') {
    return;
  }

  const route = pageInstance.route;
  tabBar.setCurrentByRoute(route);
}

module.exports = {
  syncCurrentTab
};
