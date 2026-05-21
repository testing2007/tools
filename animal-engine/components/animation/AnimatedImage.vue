<template>
  <view
    class="animated-image"
    :style="{ borderRadius: radius, '--fade-duration': `${duration}ms` }"
  >
    <image
      class="animated-image__img"
      :class="{ 'is-loaded': loaded }"
      :src="src"
      :mode="mode"
      @load="handleLoad"
      @error="handleError"
    />
    <view v-if="!loaded && !error" class="animated-image__placeholder">
      <view class="animated-image__placeholder-core" />
      <view class="animated-image__shimmer" />
    </view>
    <view v-if="error" class="animated-image__fallback">
      <text class="animated-image__fallback-text">{{ altText }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: "AnimatedImage",
  props: {
    src: {
      type: String,
      default: ""
    },
    mode: {
      type: String,
      default: "aspectFill"
    },
    duration: {
      type: Number,
      default: 260
    },
    alt: {
      type: String,
      default: "图片加载失败"
    },
    radius: {
      type: String,
      default: "28rpx"
    }
  },
  data() {
    return {
      loaded: false,
      error: false
    };
  },
  computed: {
    altText() {
      return this.alt || "图片加载失败";
    }
  },
  methods: {
    handleLoad() {
      this.error = false;
      this.loaded = true;
    },
    handleError() {
      // 图片加载失败时切到兜底占位，避免页面直接留空。
      this.error = true;
      this.loaded = false;
    }
  }
};
</script>

<style scoped lang="scss">
.animated-image {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #f1e6da, #ead8c7);
}

.animated-image__img {
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(1.04);
  transition:
    opacity var(--fade-duration) ease,
    transform var(--fade-duration) ease;

  &.is-loaded {
    opacity: 1;
    transform: scale(1);
  }
}

.animated-image__placeholder,
.animated-image__fallback {
  position: absolute;
  inset: 0;
}

.animated-image__placeholder {
  overflow: hidden;
}

.animated-image__placeholder-core {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.28), transparent 30%),
    linear-gradient(160deg, #efe2d4, #e3cfbb);
}

.animated-image__shimmer {
  position: absolute;
  inset: -20% -60%;
  background: linear-gradient(
    110deg,
    rgba(255, 255, 255, 0) 25%,
    rgba(255, 255, 255, 0.42) 48%,
    rgba(255, 255, 255, 0) 72%
  );
  animation: shimmerMove 1.8s ease-in-out infinite;
}

.animated-image__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #f1e6da, #e4d1bf);
}

.animated-image__fallback-text {
  font-size: 24rpx;
  color: #8e776a;
}

@keyframes shimmerMove {
  0% {
    transform: translate3d(-32%, 0, 0);
  }

  100% {
    transform: translate3d(32%, 0, 0);
  }
}
</style>
