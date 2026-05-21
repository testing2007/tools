<template>
  <view class="skeleton" :class="{ 'is-static': !animated }">
    <view v-for="item in count" :key="item" class="skeleton-card glass-card">
      <view class="skeleton-card__image skeleton-shimmer" />
      <view class="skeleton-card__body">
        <view class="skeleton-line skeleton-line--title skeleton-shimmer" />
        <view class="skeleton-line skeleton-line--desc skeleton-shimmer" />
        <view class="skeleton-line skeleton-line--price skeleton-shimmer" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: "PageSkeleton",
  props: {
    count: {
      type: Number,
      default: 4,
    },
    animated: {
      type: Boolean,
      default: true,
    },
  },
};
</script>

<style scoped lang="scss">
.skeleton {
  display: grid;
  gap: 28rpx;
}

.skeleton-card {
  overflow: hidden;
  border-radius: 32rpx;
  padding: 20rpx;
}

.skeleton-card__image {
  height: 280rpx;
  border-radius: 24rpx;
}

.skeleton-card__body {
  padding: 22rpx 8rpx 6rpx;
}

.skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  margin-bottom: 16rpx;
}

.skeleton-line--title {
  width: 72%;
  height: 30rpx;
}

.skeleton-line--desc {
  width: 92%;
}

.skeleton-line--price {
  width: 38%;
  margin-bottom: 0;
}

.skeleton-shimmer {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, #efdfd0, #e4d0bc);

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(255, 255, 255, 0) 28%,
      rgba(255, 255, 255, 0.42) 48%,
      rgba(255, 255, 255, 0) 72%
    );
    animation: skeletonSweep 1.65s ease-in-out infinite;
  }
}

.is-static {
  .skeleton-shimmer::after {
    animation: none;
  }
}

@keyframes skeletonSweep {
  0% {
    transform: translate3d(-48%, 0, 0);
  }

  100% {
    transform: translate3d(48%, 0, 0);
  }
}
</style>
