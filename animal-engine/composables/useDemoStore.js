// 小程序端先用最朴素的单例状态，避开部分运行时对 Vue 响应式 API 的兼容差异。
const state = {
  currentTab: "home",
  homeLoading: true,
  cartCount: 1,
  cartBounceTick: 0,
  flyTaskId: 0
};

function setCurrentTab(tab) {
  state.currentTab = tab;
}

function setHomeLoading(value) {
  state.homeLoading = value;
}

function increaseCartCount(step = 1) {
  state.cartCount += step;
}

function triggerCartBounce() {
  state.cartBounceTick += 1;
}

function nextFlyTaskId() {
  state.flyTaskId += 1;
  return state.flyTaskId;
}

export function useDemoStore() {
  return {
    state,
    setCurrentTab,
    setHomeLoading,
    increaseCartCount,
    triggerCartBounce,
    nextFlyTaskId
  };
}
