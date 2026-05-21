const TAB_LIST = [
  {
    key: "home",
    pagePath: "/pages/home/index",
    text: "首页",
    iconPath: "/static/tabbar/home-inactive.png",
    selectedIconPath: "/static/tabbar/home-active.png"
  },
  {
    key: "category",
    pagePath: "/pages/category/index",
    text: "分类",
    iconPath: "/static/tabbar/category-inactive.png",
    selectedIconPath: "/static/tabbar/category-active.png"
  },
  {
    key: "cart",
    pagePath: "/pages/cart/index",
    text: "购物车",
    iconPath: "/static/tabbar/car-inactive.png",
    selectedIconPath: "/static/tabbar/car-active.png"
  },
  {
    key: "mine",
    pagePath: "/pages/mine/index",
    text: "我的",
    iconPath: "/static/tabbar/mine-inactive.png",
    selectedIconPath: "/static/tabbar/mine-active.png"
  }
];

Component({
  data: {
    selected: 0,
    cartCount: 1,
    bounceTick: 0,
    list: TAB_LIST
  },
  pageLifetimes: {
    show() {
      this.syncCurrentTab();
    }
  },
  lifetimes: {
    attached() {
      this.syncCurrentTab();
    }
  },
  methods: {
    syncCurrentTab() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = currentPage ? `/${currentPage.route}` : "/pages/home/index";
      const selected = Math.max(0, TAB_LIST.findIndex((item) => item.pagePath === route));
      const cartCount = wx.getStorageSync("animal_engine_cart_count") || 1;

      this.setData({
        selected,
        cartCount
      });
    },
    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      if (index === this.data.selected) {
        return;
      }

      // 原生 switchTab 不销毁自定义 tabbar，能明显减少页面切换时的闪烁。
      wx.switchTab({
        url: path
      });
    },
    updateCart(count) {
      this.setData({
        cartCount: count,
        bounceTick: Date.now()
      });
    }
  }
});
