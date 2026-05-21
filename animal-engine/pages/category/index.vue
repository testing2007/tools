<template>
  <view class="page sub-page">
    <FadeInSection :show="visible">
      <view class="sub-page__hero glass-card">
        <text class="sub-page__eyebrow">CATEGORY</text>
        <text class="sub-page__title">分类页切换动效</text>
        <text class="sub-page__desc">
          这里保留轻量内容，只负责承接 tabbar 切换后的入场反馈，避免样板页过重。
        </text>
      </view>
      <view class="sub-page__grid">
        <view v-for="item in categories" :key="item.title" class="sub-page__block glass-card">
          <text class="sub-page__block-title">{{ item.title }}</text>
          <text class="sub-page__block-desc">{{ item.desc }}</text>
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
  name: "CategoryPage",
  components: {
    FadeInSection
  },
  data() {
    const demoStore = useDemoStore();
    return {
      storeActions: demoStore,
      visible: false,
      visibleTimer: null,
      categories: [
        { title: "轻乳茶", desc: "演示页面切换后，内容区整体上移并淡入。" },
        { title: "冰沙气泡", desc: "保留轻量结构，专注观察 tabbar 激活态变化。" },
        { title: "热饮专区", desc: "真实业务接入时，这里可以继续挂载列表与筛选动效。" }
      ]
    };
  },
  mounted() {
    this.storeActions.setCurrentTab("category");
    this.syncNativeTabbar();
    this.visibleTimer = setTimeout(() => {
      this.visible = true;
    }, 80);
  },
  onShow() {
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
  padding: 48rpx 24rpx 0;
  background:
    radial-gradient(circle at right top, rgba(248, 227, 176, 0.42), transparent 32%),
    linear-gradient(180deg, #f6f3ee 0%, #f4eee7 100%);
}

.sub-page__hero,
.sub-page__block {
  border-radius: 34rpx;
}

.sub-page__hero {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 30rpx;
}

.sub-page__eyebrow {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: #9b7a68;
}

.sub-page__title {
  font-size: 40rpx;
  font-weight: 700;
}

.sub-page__desc,
.sub-page__block-desc {
  font-size: 24rpx;
  line-height: 1.6;
  color: #7f695e;
}

.sub-page__grid {
  display: grid;
  gap: 22rpx;
  margin-top: 24rpx;
}

.sub-page__block {
  padding: 26rpx 28rpx;
}

.sub-page__block-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
