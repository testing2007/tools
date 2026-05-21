<template>
  <view
    class="fade-section"
    :class="{ 'is-visible': show }"
    :style="sectionStyle"
  >
    <slot />
  </view>
</template>

<script>
export default {
  name: "FadeInSection",
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    delay: {
      type: Number,
      default: 0,
    },
    offsetY: {
      type: Number,
      default: 24,
    },
  },
  computed: {
    sectionStyle() {
      return {
        transitionDelay: `${this.delay}ms`,
        "--offset-y": `${this.offsetY}rpx`,
      };
    },
  },
};
</script>

<style scoped lang="scss">
.fade-section {
  opacity: 0;
  transform: translate3d(0, var(--offset-y), 0);
  transition:
    opacity 300ms ease,
    transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);

  &.is-visible {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
