# 滚动驱动动画 (Scroll-Driven Animation) 概念指北

## 背景与需求
当前的交互模式为：“滚动到某个特定组/图片可见时，**触发一次性的过渡动画**（如从边界外固定飞入，采用 CSS `transition` 完成）”。  
新版需求变更为：**真正的跟随滚动而动的滚动驱动动画 (Scroll-Driven Animation)**，不依赖单纯的进入视口即触发，而是与用户的滑动条 (Scroll Progress) **1:1 绑定映射**。

> **核心原则**：不滑动就不动，滑动多少就对应渲染出多少动画进度，任意时刻停下（甚至反向滑动），动画也会定格或回退到相应的精确中间态。可参考 [ScrollMagic](https://scrollmagic.io/examples/basic/simple_tweening.html) 的执行方式。

## 数据结构设计理念 (示例)

未来的 `productConfig` (或扩展配置) 应当在原来的浮层 `anim` 配置基础上，支持插值区间映射方案，例如：

```json
{
  "overlays": [
    {
      "id": "ov_01",
      "type": "card",
      "pos": { "x": 50, "y": 50 },
      "scrollAnim": {
        "triggerStart": 50,   // 定义这个容器或者页面的滚动进度起点 (例如 0~100 进度系统下的 50)
        "triggerEnd": 80,     // 滚动进度的终点
        "mapping": {
          // 意图：当主滚动条在 [50, 80] 区间运动时，将该区间映射到 scale [0.5, 1.0] 的缩放比例
          "scale": [0.5, 1.0],
          // 同时透明度在此区间从 0 到 1 线性变化
          "opacity": [0, 1]
        }
      }
    }
  ]
}
```

## 执行逻辑推演

1. **区间数学映射 (Interpolation)**：  
   用户滑动详情页到底部，监听器 (`onScroll` 或 wx.createIntersectionObserver / ScrollTimeline)。  
   假设总体可滚动范围被标准化为 `0 ~ 100`，当前滚动进度为 `P` (例如 `P = 65`)。
   
   执行判断：
   - 当 `P < 50` 时，渲染最初始状态 (scale=0.5, opacity=0)。
   - 当 `P` 在 `50 ~ 80` 之间时，进行线性插值计算。
     例如 `P = 65` 正好处于 50 和 80 的绝对中点 (50%)：
     `scale` = `0.5 + (1.0 - 0.5) * 50%` = **0.75**  
     `opacity` = `0 + (1 - 0) * 50%` = **0.5**
   - 当 `P > 80` 时，渲染最末端状态 (scale=1.0, opacity=1)。

2. **渲染层实现**：
   - 小程序端不再使用 `transition: transform 650ms`，因为我们不想要时间上的补间，而想要基于滚动位置的补间。
   - 小程序可以通过 `scroll-view` 的 `bindscroll` 获取 `scrollTop` 实时计算。或者更先进的做法：利用小程序的类似于 WXS 响应极速滑动的能力，将插值计算过程放在 WXS 中。
   - 对 DOM 进行动态的 inline `transform: scale(0.75)` 切片级重绘，或者直接修改 CSS 变量。

## 对 Admin Editor 的改造要求
为了实现这种所见即所得的可视化配置，Admin Editor 必须具备：
1. **统一的时间轴/滚动轴面板**：不再是单独配置一个 `duration: 650ms`。必须有一个模拟详情页的纵向轨道，以及明确标出 `Start (50)` 和 `End (80)` 相对于视口发生点的滑块。
2. **多状态抓拍/打点能力 (Keyframe-based)**：允许用户选择在起始状态该元件的样子（放到多大、透明度多少、平移到哪里），再选择在终止状态的样子，编辑器内部通过插值映射把这两条“关键帧”计算为如上所示的 JSON 并导出。

## 总结
将“时间”维度的过渡（Time-based transition），全面转向“空间/进度”维度的过渡（Scroll-driven interpolation）。这是对高级数字展厅或 Apple 官网风格落地页的常见实现技巧。
