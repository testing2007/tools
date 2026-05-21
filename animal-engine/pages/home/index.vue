<template>
  <view class="page home-page">
    <view class="home-page__hero glass-card">
      <image class="home-page__logo" src="/static/logo.png" mode="aspectFit" />
      <view class="home-page__hero-copy">
        <text class="home-page__eyebrow">ANIMAL ENGINE</text>
        <text class="home-page__title brand-gradient-text"
          >更顺手的小程序动效样板</text
        >
        <text class="home-page__desc">
          首屏集中演示骨架屏、图片占位加载、tabbar 切换和购物车飞入动画。
        </text>
      </view>
    </view>

    <view class="home-page__section">
      <view class="home-page__section-head">
        <text class="home-page__section-title">本周主推</text>
        <text class="home-page__section-tip">点击加购，观察飞入轨迹</text>
      </view>

      <PageSkeleton v-if="homeLoading" :count="4" />

      <FadeInSection v-else :show="!homeLoading">
        <view class="goods-grid">
          <view
            v-for="product in products"
            :key="product.id"
            class="goods-card glass-card"
          >
            <view class="goods-card__media">
              <AnimatedImage :src="product.image" :alt="product.name" />
              <view class="goods-card__tag">{{ product.tag }}</view>
            </view>
            <view class="goods-card__body">
              <text class="goods-card__name">{{ product.name }}</text>
              <text class="goods-card__desc">{{ product.desc }}</text>
              <view class="goods-card__foot">
                <view class="goods-card__price-wrap">
                  <text class="goods-card__price-label">￥</text>
                  <text class="goods-card__price">{{ product.price }}</text>
                </view>
                <button class="goods-card__btn" @tap="handleAddToCart($event)">
                  加入购物车
                </button>
              </view>
            </view>
          </view>
        </view>
      </FadeInSection>
    </view>

    <view class="safe-bottom-space" />
    <view class="fly-layer">
      <image
        v-for="item in flyItems"
        :key="item.id"
        class="fly-layer__item"
        src="/static/cart.png"
        :style="item.style"
      />
    </view>
  </view>
</template>

<script>
import AnimatedImage from "../../components/animation/AnimatedImage.vue";
import FadeInSection from "../../components/animation/FadeInSection.vue";
import PageSkeleton from "../../components/animation/PageSkeleton.vue";
import { useDemoStore } from "../../composables/useDemoStore";
import { mockProducts } from "../../mock/products";

const requestFrame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame.bind(globalThis)
    : (cb) => setTimeout(() => cb(Date.now()), 16);

function easeOutPeak(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

export default {
  name: "HomePage",
  components: {
    AnimatedImage,
    FadeInSection,
    PageSkeleton,
  },
  data() {
    const demoStore = useDemoStore();
    return {
      storeActions: demoStore,
      homeLoading: true,
      products: mockProducts,
      cartCount: demoStore.state.cartCount,
      flyItems: [],
      loadingTimer: null,
    };
  },
  mounted() {
    this.storeActions.setCurrentTab("home");
    this.syncNativeTabbar();
    this.loadingTimer = setTimeout(() => {
      this.homeLoading = false;
    }, 780);
  },
  onShow() {
    this.syncNativeTabbar();
  },
  beforeUnmount() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
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
    },
    getCartAnchorRect() {
      const systemInfo = uni.getSystemInfoSync();
      const horizontalPadding = uni.upx2px(22);
      const bottomInset = systemInfo.safeAreaInsets
        ? systemInfo.safeAreaInsets.bottom
        : 0;
      const panelVerticalPadding = uni.upx2px(18) + bottomInset;
      const iconWrapSize = uni.upx2px(76);
      const panelWidth = systemInfo.windowWidth - horizontalPadding * 2;
      const itemWidth = panelWidth / 4;
      const cartCenterX = horizontalPadding + itemWidth * 2.5;
      const cartCenterY =
        systemInfo.windowHeight -
        panelVerticalPadding -
        uni.upx2px(14) -
        iconWrapSize / 2;

      return {
        left: cartCenterX - iconWrapSize / 2,
        top: cartCenterY - iconWrapSize / 2,
        width: iconWrapSize,
        height: iconWrapSize,
      };
    },
    buildFlyStyle(item) {
      return [
        `width:${item.size}px`,
        `height:${item.size}px`,
        `opacity:${item.opacity}`,
        `transform:translate3d(${item.x}px, ${item.y}px, 0) scale(${item.scale})`,
      ].join(";");
    },
    startFlyAnimation(startRect, endRect) {
      const startX = startRect.left + startRect.width / 2 - 18;
      const startY = startRect.top + startRect.height / 2 - 18;
      const endX = endRect.left + endRect.width / 2 - 18;
      const endY = endRect.top + endRect.height / 2 - 18;
      const controlX = startX + (endX - startX) * 0.45;
      const controlY = Math.min(startY, endY) - 180;
      const id = this.storeActions.nextFlyTaskId();
      const item = {
        id,
        x: startX,
        y: startY,
        scale: 1,
        opacity: 1,
        size: 36,
        style: "",
      };

      item.style = this.buildFlyStyle(item);
      this.flyItems = [...this.flyItems, item];

      const startTime = Date.now();
      const duration = 620;

      const step = () => {
        const elapsed = Date.now() - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const progress = easeOutPeak(rawProgress);

        // 二次贝塞尔轨迹计算飞行点，让飞入既顺滑又足够轻量。
        item.x =
          Math.pow(1 - progress, 2) * startX +
          2 * (1 - progress) * progress * controlX +
          Math.pow(progress, 2) * endX;
        item.y =
          Math.pow(1 - progress, 2) * startY +
          2 * (1 - progress) * progress * controlY +
          Math.pow(progress, 2) * endY;
        item.scale = 1 - progress * 0.42;
        item.opacity = 1 - Math.max(0, rawProgress - 0.72) / 0.28;
        item.style = this.buildFlyStyle(item);
        this.flyItems = [...this.flyItems];

        if (rawProgress < 1) {
          requestFrame(step);
          return;
        }

        this.flyItems = this.flyItems.filter((flight) => flight.id !== id);
        this.handleFlyComplete();
      };

      requestFrame(step);
    },
    handleAddToCart(event) {
      const touch =
        event && event.changedTouches ? event.changedTouches[0] : null;
      const startRect = touch
        ? {
            left: touch.clientX - 12,
            top: touch.clientY - 12,
            width: 24,
            height: 24,
          }
        : {
            left: uni.upx2px(540),
            top: uni.upx2px(620),
            width: 24,
            height: 24,
          };

      this.startFlyAnimation(startRect, this.getCartAnchorRect());
    },
    handleFlyComplete() {
      this.storeActions.increaseCartCount(1);
      this.storeActions.triggerCartBounce();
      this.cartCount = this.storeActions.state.cartCount;
      uni.setStorageSync("animal_engine_cart_count", this.cartCount);

      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      const tabBar = page && page.getTabBar ? page.getTabBar() : null;
      if (tabBar && tabBar.updateCart) {
        tabBar.updateCart(this.cartCount);
      }
    },
  },
};
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 42rpx 24rpx 0;
  background:
    radial-gradient(
      circle at top left,
      rgba(248, 219, 189, 0.5),
      transparent 34%
    ),
    linear-gradient(180deg, #f6f3ee 0%, #f4eee7 100%);
}

.home-page__hero {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 24rpx;
  border-radius: 36rpx;
}

.home-page__logo {
  width: 120rpx;
  height: 120rpx;
  flex-shrink: 0;
  border-radius: 30rpx;
}

.home-page__hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.home-page__eyebrow {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: #9b7a68;
}

.home-page__title {
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.18;
}

.home-page__desc {
  font-size: 24rpx;
  line-height: 1.6;
  color: #7b655a;
}

.home-page__section {
  margin-top: 30rpx;
}

.home-page__section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 8rpx;
}

.home-page__section-title {
  font-size: 34rpx;
  font-weight: 700;
}

.home-page__section-tip {
  font-size: 22rpx;
  color: #9b7a68;
}

.goods-grid {
  display: grid;
  gap: 26rpx;
}

.goods-card {
  overflow: hidden;
  border-radius: 34rpx;
  padding: 18rpx;
}

.goods-card__media {
  position: relative;
  height: 296rpx;
  border-radius: 28rpx;
  overflow: hidden;
}

.goods-card__tag {
  position: absolute;
  left: 18rpx;
  top: 18rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 250, 245, 0.9);
  color: #b76442;
  font-size: 20rpx;
  font-weight: 600;
}

.goods-card__body {
  padding: 22rpx 8rpx 8rpx;
}

.goods-card__name {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
}

.goods-card__desc {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: #887064;
}

.goods-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
}

.goods-card__price-wrap {
  display: flex;
  align-items: baseline;
  color: #ab4d30;
}

.goods-card__price-label {
  font-size: 24rpx;
  margin-right: 4rpx;
}

.goods-card__price {
  font-size: 36rpx;
  font-weight: 700;
}

.goods-card__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 192rpx;
  height: 76rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #cc7b57, #a84d31);
  color: #fff8f3;
  font-size: 24rpx;
  font-weight: 600;
  box-shadow: 0 14rpx 30rpx rgba(168, 77, 49, 0.18);
  transition:
    transform 120ms ease,
    opacity 120ms ease;

  &:active {
    opacity: 0.9;
    transform: scale(0.96);
  }
}

.fly-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}

.fly-layer__item {
  position: fixed;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 26rpx rgba(169, 85, 48, 0.22);
  will-change: transform, opacity;
}
</style>
