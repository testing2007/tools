module.exports = {
  // Global cross-group gesture behavior.
  // mode: 'snap' | 'flow'
  // threshold: minimum overflow distance(px) to switch group.
  // velocityThreshold: minimum gesture velocity(px/ms) to switch by flick.
  // resistance: boundary damping factor in snap/flow overflow range.
  // flowStart: reserved compatibility field, keep in config for future tuning.
  groupTransition: {
    mode: 'snap',
    threshold: 110,
    velocityThreshold: 0.45,
    resistance: 0.26,
    flowStart: 0.58
  },
  groups: [
    {
      images: [
        {
          id: 'img0',
          src: '/assets/01.jpg',
          overlays: [
            {
              type: 'tag',
              // pos is the final anchor position in image space:
              // <=1 means ratio (0.5 => 50%), >1 means direct percentage.
              pos: { x: 0.033, y: 0.463 },
              anim: {
                type: 'slideX_right',
                // Overlay visibility progress window in viewport progress [0..1].
                startPos: 0,
                endPos: 0.18,
                // Motion from -> to (unit supports rpx/px/%)
                from: { x: -72, y: 0, unit: 'rpx' },
                to: { x: 0, y: 0, unit: 'rpx' },
                fromOpacity: 0,
                toOpacity: 1
              },
              style: {
                color: '#111111',
                fontSize: 37,
                fontWeight: '700',
                bgColor: null,
                bgBlur: true,
                boxShadow: false
              },
              icon: '✓',
              label: '全新型号'
            }
          ]
        },
        {
          id: 'img1',
          src: '/assets/02.jpg',
          overlays: [
            {
              type: 'card',
              pos: { x: 0.454, y: 0.634 },
              anim: {
                type: 'fade',
                startPos: 0.15,
                endPos: 0.72,
                from: { x: 0, y: 48, unit: 'rpx' },
                to: { x: 0, y: 0, unit: 'rpx' },
                fromOpacity: 0,
                toOpacity: 1,
                fromScale: 0.96,
                toScale: 1
              },
              style: {
                color: '#111111',
                fontSize: 28,
                fontWeight: '700',
                bgColor: 'rgba(255,255,255,0.93)',
                bgBlur: false,
                boxShadow: false
              },
              eyebrow: '精选功能',
              title: '震撼视觉',
              desc: '滚动时卡片会更顺滑地贴合图片节奏。'
            }
          ]
        }
      ]
    },
    {
      images: [
        {
          id: 'img_v5c8',
          src: '/assets/03.jpg',
          overlays: [
            {
              type: 'tag',
              pos: { x: 0.05, y: 0.15 },
              anim: {
                type: 'slideX_right',
                startPos: 0.15,
                endPos: 0.8,
                from: { x: -60, y: 0, unit: 'rpx' },
                to: { x: 0, y: 0, unit: 'rpx' }
              },
              style: {
                color: '#111111',
                fontSize: 28,
                fontWeight: '700',
                bgColor: 'rgba(255,255,255,0.93)',
                bgBlur: true,
                boxShadow: true
              },
              icon: '✓',
              label: '新特性'
            }
          ]
        }
      ]
    }
  ]
};
