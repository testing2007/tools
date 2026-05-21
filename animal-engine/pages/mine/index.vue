<template>
  <view class="page mine-page">
    <FadeInSection :show="visible">
      <view class="profile-card glass-card">
        <text class="profile-card__eyebrow">MINE</text>
        <text class="profile-card__title">我的页切换演示</text>
        <text class="profile-card__desc">
          这里主要用来观察 tabbar 高亮和页面入场动画，结构保持简洁，避免干扰对动效的判断。
        </text>
        <view class="profile-card__stats">
          <view class="profile-card__stat">
            <text class="profile-card__stat-value">4</text>
            <text class="profile-card__stat-label">已演示页面</text>
          </view>
          <view class="profile-card__stat">
            <text class="profile-card__stat-value">{{ cartCount }}</text>
            <text class="profile-card__stat-label">购物车数量</text>
          </view>
        </view>
      </view>
    </FadeInSection>

    <view class="safe-bottom-space" />
  </view>
</template>

<script>
import FadeInSection from "../../components/animation/FadeInSection.vue";
import { useDemoStore } from "../../composables/useDemoStore";

export default {
  name: "MinePage",
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
    this.storeActions.setCurrentTab("mine");
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
    radial-gradient(circle at left top, rgba(236, 216, 192, 0.38), transparent 30%),
    linear-gradient(180deg, #f6f3ee 0%, #f3ede6 100%);
}

.profile-card {
  border-radius: 36rpx;
  padding: 34rpx 30rpx;
}

.profile-card__eyebrow {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: #9b7a68;
}

.profile-card__title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  font-weight: 700;
}

.profile-card__desc {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #7f695e;
}

.profile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 28rpx;
}

.profile-card__stat {
  padding: 24rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgba(255, 247, 239, 0.92), rgba(247, 234, 222, 0.92));
}

.profile-card__stat-value {
  display: block;
  font-size: 46rpx;
  font-weight: 700;
  color: #ab4d30;
}

.profile-card__stat-label {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8d7468;
}
</style>
