// =====================================================
// pages/detail/detail.js  (Skyline Worklet 版本)
// =====================================================

Page({
  data: {
    goods: {
      image: '/assets/01.jpg',
      price: '299.00',
      originalPrice: '599.00',
      title: '2024新款潮流运动鞋 男女同款 透气飞织跑步鞋',
      desc: '采用最新飞织工艺，轻盈透气，缓震回弹'
    }
  },

  onReady() {
    this.bindScrollAnimation()
  },

  bindScrollAnimation() {
    // 获取 scroll-view 实例
    const scrollView = this.createSelectorQuery().select('#mainScroll')

    // ========== 1. 导航栏渐显动画 ==========
    this.applyAnimatedStyle('#navBar', () => {
      'worklet'
      // scrollTop 通过 shared value 传入
      const scrollTop = this._scrollTop.value
      const progress = Math.min(Math.max((scrollTop - 200) / 150, 0), 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      return {
        opacity: eased,
        backgroundColor: `rgba(255, 255, 255, ${eased})`,
        backdropFilter: `blur(${eased * 20}px)`
      }
    })

    // ========== 2. 底部操作栏滑入动画 ==========
    this.applyAnimatedStyle('#bottomBar', () => {
      'worklet'
      const scrollTop = this._scrollTop.value
      const show = scrollTop > 50
      const progress = show
        ? Math.min((scrollTop - 50) / 100, 1)
        : 0
      const eased = 1 - Math.pow(1 - progress, 3)
      return {
        transform: `translateY(${(1 - eased) * 100}%)`,
        opacity: eased
      }
    })

    // ========== 3. 回到顶部按钮动画 ==========
    this.applyAnimatedStyle('#backTopBtn', () => {
      'worklet'
      const scrollTop = this._scrollTop.value
      const show = scrollTop > 800
      const progress = show
        ? Math.min((scrollTop - 800) / 200, 1)
        : 0
      const eased = 1 - Math.pow(1 - progress, 3)
      return {
        transform: `scale(${0.5 + 0.5 * eased})`,
        opacity: eased
      }
    })

    // ========== 4. 商品图片视差滚动 ==========
    this.applyAnimatedStyle('#heroImage', () => {
      'worklet'
      const scrollTop = this._scrollTop.value
      // 图片以一半速度跟随滚动 → 视差效果
      const parallax = scrollTop * 0.5
      // 滚动时微微缩放
      const scale = 1 + Math.max(0, scrollTop * -0.001)
      return {
        transform: `translateY(${parallax}px) scale(${scale})`
      }
    })

    // ========== 5. 价格标签弹入动画 ==========
    this.applyAnimatedStyle('#priceTag', () => {
      'worklet'
      const scrollTop = this._scrollTop.value
      // 当价格区域进入视口时
      const triggerPoint = 300
      const progress = Math.min(Math.max((scrollTop - triggerPoint + 500) / 200, 0), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      return {
        transform: `translateX(${(1 - eased) * -50}px)`,
        opacity: eased
      }
    })
  },

  // 监听 scroll-view 滚动
  onScrollViewScroll(e) {
    // Skyline 下可以使用 worklet 来监听 scrollTop
    // 但简单做法是在 scroll 事件中更新 shared value
  },

  // ---- Skyline Worklet 核心方法 ----
  // 使用 scroll-view 的 worklet:onscroll 事件
  handleScroll(e) {
    'worklet'
    // 直接在 worklet 中更新 shared value
    this._scrollTop.value = e.detail.scrollTop
  },

  onLoad() {
    // 创建 shared value
    this._scrollTop = wx.worklet.shared(0)
  },

  goBack() {
    wx.navigateBack()
  },

  scrollToTop() {
    this.createSelectorQuery()
      .select('#mainScroll')
      .node()
      .exec((res) => {
        if (res[0] && res[0].node) {
          res[0].node.scrollTo({ top: 0, behavior: 'smooth' })
        }
      })
  }
})
