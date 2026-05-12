module.exports = {
  // 全局跨组切换参数：
  // - mode: snap 表示达到阈值后整组切换；flow 表示越界后可连续拖动 outerY
  // - threshold: 越界多少像素后，认为可以触发切组
  // - velocityThreshold: 甩动速度达到该值时，即使越界不足也可切组
  // - resistance: 越界阻尼，值越大越“紧”
  groupTransition: {
    mode: 'snap',
    threshold: 110,
    velocityThreshold: 0.45,
    resistance: 0.26,
    flowStart: 0.58
  },

  // 这里按你的要求把 9 张图划成 5 个组，方便观察：
  // 第 1 组: 01、02
  // 第 2 组: 03
  // 第 3 组: 04、05、06
  // 第 4 组: 07、08
  // 第 5 组: 09
  groups: [
    {
      // 第一组：两张图，适合观察 groupY 在组内滚动时的变化
      images: [
        { id: 'group1_img01', src: '/assets/01.jpg', overlays: [] },
        { id: 'group1_img02', src: '/assets/02.jpg', overlays: [] }
      ]
    },
    {
      // 第二组：单张图，适合观察单屏分组切换时 outerY 的变化
      images: [
        { id: 'group2_img03', src: '/assets/03.jpg', overlays: [] }
      ]
    },
    {
      // 第三组：三张图，适合观察较长内容在组内的滚动距离和边界
      images: [
        { id: 'group3_img04', src: '/assets/04.jpg', overlays: [] },
        { id: 'group3_img05', src: '/assets/05.jpg', overlays: [] },
        { id: 'group3_img06', src: '/assets/06.jpg', overlays: [] }
      ]
    },
    {
      // 第四组：两张图，用来观察从长组切回较短组时的切组体验
      images: [
        { id: 'group4_img07', src: '/assets/07.jpg', overlays: [] },
        { id: 'group4_img08', src: '/assets/08.jpg', overlays: [] }
      ]
    },
    {
      // 第五组：单张图，作为最后一组，便于观察底部边界行为
      images: [
        { id: 'group5_img09', src: '/assets/09.jpg', overlays: [] }
      ]
    }
  ]
};
