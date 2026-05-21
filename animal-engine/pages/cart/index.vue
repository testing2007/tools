<template>
  <view class="page cart-page">
    <FadeInSection :show="visible">
      <view class="cart-panel glass-card">
        <text class="cart-panel__eyebrow">CART STATUS</text>
        <text class="cart-panel__title">购物车状态承接</text>
        <view class="cart-panel__count-row">
          <image class="cart-panel__icon" src="/static/cart.png" mode="aspectFit" />
          <view class="cart-panel__count-wrap">
            <text class="cart-panel__count-label">当前数量</text>
            <text class="cart-panel__count">{{ cartCount }}</text>
          </view>
        </view>
        <text class="cart-panel__desc">
          首页每次飞入完成后，这里的数量会同步增长，用来验证加购结果正确承接。
        </text>
      </view>
    </FadeInSection>

    <view class="safe-bottom-space" />
  </view>
</template>

<script>
import FadeInSection from "../../components/animation/FadeInSection.vue";
import { useDemoStore } from "../../composables/useDemoStore";

export default {
  name: "CartPage",
  components: {
    FadeInSection
  },
  data() {
    const demoStore = useDemoStore();
    return {
      storeActions: demoStore,
      cartCount: demoStore.state.cartCount,
      visible: false,
      visibleTimer: null
    };
  },
  mounted() {
    this.storeActions.setCurrentTab("cart");
    this.cartCount = uni.getStorageSync("animal_engine_cart_count") || this.cartCount;
    this.syncNativeTabbar();
    this.visibleTimer = setTimeout(() => {
      this.visible = true;
    }, 80);
  },
  onShow() {
    this.cartCount = uni.getStorageSync("animal_engine_cart_count") || this.cartCount;
    this.syncNativeTabbar();
  },
  beforeUnmount() {
    if (this.visibleTimer) {
      clearTimeout(this.visibleTimer);
      this.visibleTimer = null;
    }
  },
  methods: {
    syncNativeTabbar() {
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      const tabBar = page && page.getTabBar ? page.getTabBar() : null;
      if (tabBar && tabBar.syncCurrentTab) {
        tabBar.syncCurrentTab();
      }
    }
  }
};
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 60rpx 24rpx 0;
  background:
    radial-gradient(circle at center top, rgba(232, 204, 177, 0.4), transparent 36%),
    linear-gradient(180deg, #f6f3ee 0%, #f3ece4 100%);
}

.cart-panel {
  border-radius: 36rpx;
  padding: 34rpx 30rpx;
}

.cart-panel__eyebrow {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: #9b7a68;
}

.cart-panel__title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  font-weight: 700;
}

.cart-panel__count-row {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin: 28rpx 0 22rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgba(255, 247, 239, 0.92), rgba(246, 229, 213, 0.92));
}

.cart-panel__icon {
  width: 92rpx;
  height: 92rpx;
}

.cart-panel__count-wrap {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.cart-panel__count-label {
  font-size: 24rpx;
  color: #8d7468;
}

.cart-panel__count {
  font-size: 54rpx;
  font-weight: 700;
  color: #ab4d30;
  line-height: 1;
}

.cart-panel__desc {
  font-size: 24rpx;
  line-height: 1.65;
  color: #7f695e;
}
</style>
