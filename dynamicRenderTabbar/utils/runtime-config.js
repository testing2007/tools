function normalizeTabCount(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n > 2 && n <= 5) {
    return n;
  }
  return 3;
}

function fetchRuntimeTabConfig() {
  const saved = wx.getStorageSync('visibleTabCount');
  const visibleTabCount = normalizeTabCount(saved || 3);
  return Promise.resolve({ visibleTabCount });
}

function saveRuntimeTabCount(value) {
  const visibleTabCount = normalizeTabCount(value);
  wx.setStorageSync('visibleTabCount', visibleTabCount);
  return visibleTabCount;
}

module.exports = {
  fetchRuntimeTabConfig,
  normalizeTabCount,
  saveRuntimeTabCount
};
