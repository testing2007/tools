开发“充满流畅动画的小程序”，核心不是到处加动画，而是建立一套 **动画能力体系**：哪些动画由 CSS 做，哪些由小程序动画 API 做，哪些由 Canvas / Lottie 做，哪些必须降级。否则很容易卡顿、难维护、低端机崩。

下面按你现在的 `zander-uniapp + Vue3 + 微信小程序` 方向讲。

---

# 一、先确定动画类型

小程序里的动画大概分 5 类：

| 类型         | 场景                                   | 推荐实现                                    |
| ------------ | -------------------------------------- | ------------------------------------------- |
| 页面切换动画 | 首页、分类页、商品详情页切换           | CSS / uni transition                        |
| 组件入场动画 | 商品卡片、优惠券、弹窗、导航栏         | CSS transition / animation                  |
| 交互反馈动画 | 按钮点击、加入购物车、点赞、领取优惠券 | CSS transform                               |
| 营销氛围动画 | 扫光、漂浮气泡、节日贴片、红包雨       | CSS / Canvas / Lottie                       |
| 复杂视觉动画 | 3D、粒子、抽奖、翻牌、大屏互动         | Canvas / Three.js / Pixi.js，谨慎用于小程序 |

你现在做奶茶店小程序，最值得做的是：

```text
商品卡片动画
按钮点击反馈
优惠券领取动画
购物车飞入动画
节日广告贴片动画
首页模块入场动画
弹窗动效
会员成长体系进度动画
积分兑换动效
团购码兑换成功动效
```

不要一开始就做 3D 和复杂粒子。先把高频交互做顺。

---

# 二、流畅动画的核心原则

## 1. 优先使用 transform 和 opacity

流畅动画优先用：

```css
transform: translateX();
transform: translateY();
transform: scale();
transform: rotate();
opacity: 0 ~1;
```

尽量避免频繁动画这些属性：

```css
width
height
top
left
margin
padding
box-shadow 大面积变化
filter 模糊
```

原因很简单：
`transform` 和 `opacity` 更容易走合成层，性能更好。

---

## 2. 动画时间不要太长

小程序常用动画时间：

```text
点击反馈：80ms - 150ms
弹窗出现：200ms - 300ms
页面模块入场：300ms - 500ms
营销氛围动画：1.5s - 3s 循环
```

如果一个按钮点击动画超过 300ms，用户会觉得慢。

---

## 3. 动画要服务业务，不要抢戏

奶茶店小程序建议这样分层：

```text
一级动画：影响转化
- 加入购物车飞入
- 领取优惠券成功
- 下单按钮反馈
- 会员升级提示

二级动画：增强氛围
- 商品卡片轻微浮动
- 节日标签扫光
- 首页 Banner 入场

三级动画：装饰
- 背景气泡
- 小图标漂浮
- 光效
```

先做一级动画，再做二级动画。三级动画要克制。

---

# 三、推荐技术方案

## 方案 1：CSS 动画，作为主力

适合：

```text
按钮反馈
卡片入场
扫光效果
弹窗缩放
优惠券抖动
商品标签闪动
```

例如按钮点击反馈：

```vue
<template>
  <view
    class="buy-btn"
    :class="{ active: pressing }"
    @touchstart="pressing = true"
    @touchend="pressing = false"
  >
    加入购物车
  </view>
</template>

<script setup>
import { ref } from "vue";

const pressing = ref(false);
</script>

<style scoped>
.buy-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  text-align: center;
  background: linear-gradient(90deg, #ff7a45, #ff4d4f);
  color: #fff;
  font-size: 30rpx;
  transition:
    transform 120ms ease,
    opacity 120ms ease;
}

.buy-btn.active {
  transform: scale(0.96);
  opacity: 0.88;
}
</style>
```

这是最稳定、最轻的方式。

---

## 方案 2：组件挂载动画，适合你的 DIY 扩展

你之前已经做了“扫光按钮”“轨道背景球挂载组件”，这个方向是对的。

建议你把动画组件抽象成：

```text
components/animation/
├── ShineOverlay.vue        扫光覆盖层
├── FloatBubble.vue         漂浮气泡
├── PulseBadge.vue          呼吸标签
├── FlyToCart.vue           加购飞入购物车
├── CouponPop.vue           优惠券弹出
├── FestivalSticker.vue     节日贴片
└── AnimationWrapper.vue    通用动画容器
```

然后商品卡片可以这样挂载：

```vue
<view class="goods-card">
  <image class="goods-img" :src="goods.picUrl" />

  <FestivalSticker
    v-if="festivalAd"
    :config="festivalAd"
  />

  <ShineOverlay v-if="goods.activityShine" />

  <view class="goods-name">{{ goods.name }}</view>
  <view class="goods-price">￥{{ goods.price }}</view>
</view>
```

这样你后面做 API DIY 时，就可以让后端返回动画配置。

---

# 四、动画配置应该后端化

你要做的是多门店奶茶系统，不是单个静态小程序。
所以动画不要全部写死在前端，应该做成配置。

例如后端返回：

```json
{
  "scene": "goods-card",
  "enabled": true,
  "type": "festival-sticker",
  "name": "520 活动贴片",
  "startTime": "2026-05-19 00:00:00",
  "endTime": "2026-05-21 23:59:59",
  "priority": 10,
  "property": {
    "text": "520 第二杯半价",
    "imageUrl": "",
    "position": "top-right",
    "animation": "shine",
    "backgroundColor": "#ff4d6d",
    "textColor": "#ffffff"
  }
}
```

前端根据 `scene` 挂载到不同位置：

```text
goods-card        商品卡片
goods-list        商品栏
goods-detail      商品详情页
home-banner       首页轮播
cart-page         购物车页
order-submit      确认订单页
coupon-center     领券中心
member-center     会员中心
```

这样你就能做到：

```text
母亲节自动显示贴片
520 自动显示活动文案
新品自动添加扫光标签
团购商品显示团购动画
会员专享商品显示会员角标
```

这才是适合 SaaS / 多门店系统的做法。

---

# 五、建议你设计一个 Animation Engine

前端可以做一个轻量动画引擎，不要每个页面自己判断。

目录建议：

```text
src/
├── animation/
│   ├── index.js
│   ├── animationRegistry.js
│   ├── animationMatcher.js
│   └── useAnimationConfig.js
```

## 1. animationRegistry.js

注册支持的动画类型：

```js
export const animationRegistry = {
  shine: {
    name: "扫光",
    component: "ShineOverlay",
  },
  pulse: {
    name: "呼吸",
    component: "PulseBadge",
  },
  float: {
    name: "漂浮",
    component: "FloatBubble",
  },
  "festival-sticker": {
    name: "节日贴片",
    component: "FestivalSticker",
  },
  "fly-to-cart": {
    name: "飞入购物车",
    component: "FlyToCart",
  },
};
```

## 2. animationMatcher.js

根据场景过滤动画：

```js
export function matchAnimations(configs, scene) {
  const now = Date.now();

  return configs
    .filter((item) => item.enabled)
    .filter((item) => item.scene === scene)
    .filter((item) => {
      const start = item.startTime ? new Date(item.startTime).getTime() : 0;
      const end = item.endTime ? new Date(item.endTime).getTime() : Infinity;
      return now >= start && now <= end;
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
```

## 3. useAnimationConfig.js

页面里直接用：

```js
import { computed } from "vue";
import { matchAnimations } from "./animationMatcher";

export function useAnimationConfig(allConfigs, scene) {
  const animations = computed(() => {
    return matchAnimations(allConfigs.value || [], scene);
  });

  return {
    animations,
  };
}
```

---

# 六、商品卡片动画设计

商品卡片是奶茶小程序的核心。
建议你把商品卡片拆成：

```text
商品图片层
商品信息层
价格层
活动标签层
动画挂载层
按钮层
```

示例结构：

```vue
<template>
  <view class="goods-card">
    <view class="image-box">
      <image class="goods-img" :src="goods.picUrl" mode="aspectFill" />

      <view class="animation-layer">
        <FestivalSticker
          v-for="item in stickerAnimations"
          :key="item.id"
          :config="item.property"
        />
      </view>
    </view>

    <view class="info-box">
      <view class="goods-name">{{ goods.name }}</view>
      <view class="goods-desc">{{ goods.introduction }}</view>

      <view class="bottom-row">
        <view class="price">￥{{ goods.price }}</view>
        <view class="add-btn" @tap="handleAddCart">+</view>
      </view>
    </view>
  </view>
</template>
```

CSS：

```css
.goods-card {
  position: relative;
  overflow: hidden;
  border-radius: 24rpx;
  background: #fff;
  transition: transform 180ms ease;
}

.goods-card:active {
  transform: scale(0.98);
}

.image-box {
  position: relative;
  width: 100%;
  height: 260rpx;
  overflow: hidden;
  border-radius: 24rpx 24rpx 0 0;
}

.goods-img {
  width: 100%;
  height: 100%;
}

.animation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
```

关键点：

```text
animation-layer 必须 pointer-events: none
否则会挡住商品点击
```

---

# 七、扫光效果实现

这个很适合商品卡片、按钮、优惠券。

```vue
<template>
  <view class="shine-overlay"></view>
</template>

<style scoped>
.shine-overlay {
  position: absolute;
  top: 0;
  left: -120%;
  width: 80%;
  height: 100%;
  transform: skewX(-20deg);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.45),
    transparent
  );
  animation: shineMove 2.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shineMove {
  0% {
    left: -120%;
  }
  45% {
    left: 120%;
  }
  100% {
    left: 120%;
  }
}
</style>
```

注意：
不要在一个页面上让几十个商品同时扫光。会卡。

建议限制：

```text
一个页面最多 3-5 个商品启用扫光
优先级高的商品才显示
滚动列表中的商品不要全部循环动画
```

---

# 八、商品加入购物车飞入动画

这是转化感最强的动画之一。

实现思路：

```text
1. 点击商品加购按钮
2. 获取按钮坐标
3. 获取购物车图标坐标
4. 创建一个临时小球 / 商品缩略图
5. 使用 transform 移动到购物车
6. 动画结束后销毁
```

uni-app 里可以用 `uni.createSelectorQuery()` 获取位置。

简化伪代码：

```js
function getRect(selector) {
  return new Promise((resolve) => {
    uni
      .createSelectorQuery()
      .select(selector)
      .boundingClientRect((rect) => resolve(rect))
      .exec();
  });
}

async function handleAddCart() {
  const start = await getRect(".add-btn");
  const end = await getRect(".cart-icon");

  flyBall.value = {
    show: true,
    startX: start.left,
    startY: start.top,
    endX: end.left,
    endY: end.top,
  };
}
```

这个动画可以做，但不要一开始复杂化。
第一版用“小圆点飞入购物车”就够了。

---

# 九、Lottie 动画是否适合小程序？

适合，但要克制。

适合场景：

```text
支付成功
领取优惠券成功
会员升级
积分兑换成功
空状态插画
节日活动页
```

不适合：

```text
商品列表中每个商品都放 Lottie
首页同时放多个 Lottie
低端机频繁播放
```

原因：Lottie 文件如果太大，会影响加载和性能。

建议：

```text
单个 Lottie JSON 控制在 100KB - 300KB 内
首屏不要加载太多
使用时再懒加载
动画结束后销毁
```

---

# 十、Canvas 动画适合哪些？

Canvas 适合：

```text
红包雨
抽奖转盘
刮刮卡
粒子背景
大屏互动
烟花庆祝
```

不适合：

```text
普通按钮
商品卡片
简单弹窗
普通标签
```

你的小程序第一阶段不用急着上 Canvas。
先 CSS + 组件挂载 + 配置化，性价比最高。

---

# 十一、动画配置后台怎么做

后台管理端建议新增一个模块：

```text
营销中心
└── 动效配置
    ├── 动效名称
    ├── 适用门店
    ├── 适用场景
    ├── 动效类型
    ├── 展示内容
    ├── 图片资源
    ├── 开始时间
    ├── 结束时间
    ├── 优先级
    ├── 状态
    └── 预览
```

数据库可以先设计成一张表：

```sql
CREATE TABLE `promotion_animation_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
  `name` varchar(100) NOT NULL COMMENT '动效名称',
  `scene` varchar(50) NOT NULL COMMENT '场景：goods-card/goods-detail/home-banner',
  `type` varchar(50) NOT NULL COMMENT '动效类型：shine/pulse/festival-sticker/fly-to-cart',
  `store_ids` varchar(500) DEFAULT NULL COMMENT '适用门店ID，逗号分隔；为空表示全部',
  `target_type` varchar(50) DEFAULT NULL COMMENT '目标类型：all-goods/category/goods/spu',
  `target_ids` varchar(1000) DEFAULT NULL COMMENT '目标ID集合',
  `property` json DEFAULT NULL COMMENT '动效属性配置',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `priority` int DEFAULT 0 COMMENT '优先级',
  `status` tinyint DEFAULT 1 COMMENT '状态：1启用 0禁用',
  `deleted` bit(1) DEFAULT b'0',
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT='营销动效配置表';
```

第一版够用了。

后面复杂了再拆：

```text
animation_config
animation_scene
animation_target
animation_material
```

但一开始别拆太细。

---

# 十二、前端接口建议

## 获取当前门店可用动效

```http
GET /app-api/promotion/animation/list?storeId=1&scene=goods-card
```

返回：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "scene": "goods-card",
      "type": "festival-sticker",
      "priority": 10,
      "property": {
        "text": "520 第二杯半价",
        "position": "top-right",
        "animation": "shine",
        "backgroundColor": "#ff4d6d"
      }
    }
  ]
}
```

## 前端缓存策略

```text
进入小程序时拉取一次全局动效配置
切换门店时重新拉取
下拉刷新时可重新拉取
不要每个商品卡片单独请求
```

---

# 十三、性能控制规则

这是重点。

## 1. 列表页不要无限动画

商品列表里最多允许：

```text
3 个扫光
5 个呼吸标签
1 个背景氛围动画
```

否则低端机容易卡。

---

## 2. 动画组件要支持关闭

每个动画配置都应该支持：

```json
{
  "enabled": true,
  "lowDeviceDisabled": true,
  "loop": true,
  "duration": 2400
}
```

你可以做一个低端机判断：

```js
export function isLowDevice() {
  const info = uni.getSystemInfoSync();
  const benchmark = info.benchmarkLevel || 0;

  return benchmark > 0 && benchmark < 20;
}
```

低端机自动关闭复杂动画。

---

## 3. 不在长列表里创建大量动画节点

商品列表中不要这样：

```text
每个商品都有 3 个绝对定位动画层
每个商品都有独立定时器
每个商品都有 Lottie
```

正确做法：

```text
只有命中配置的商品才挂载动画
滚动区域内才显示
离屏后销毁或暂停
```

---

# 十四、推荐开发顺序

你可以按这个顺序做。

## 第一阶段：基础动画组件

先做这些：

```text
1. 按钮点击反馈
2. 商品卡片点击反馈
3. 弹窗出现/关闭动画
4. 扫光组件 ShineOverlay
5. 呼吸标签 PulseBadge
6. 节日贴片 FestivalSticker
```

目标：让小程序看起来明显更有质感。

---

## 第二阶段：动效配置化

做后台配置：

```text
1. 动效配置表
2. 管理端 CRUD
3. 小程序端查询接口
4. 按 scene 渲染动效
5. 支持时间自动显示/隐藏
6. 支持门店维度
```

目标：520、母亲节、父亲节、端午节这些活动不用发版。

---

## 第三阶段：业务转化动画

做这些：

```text
1. 加入购物车飞入动画
2. 领取优惠券成功动画
3. 积分兑换成功动画
4. 团购码兑换成功动画
5. 支付成功动画
6. 会员升级动画
```

目标：增强用户完成动作后的反馈。

---

## 第四阶段：营销玩法动画

再做：

```text
1. 红包雨
2. 抽奖转盘
3. 翻牌
4. 刮刮卡
5. 签到动画
6. 会员成长进度动画
```

目标：支撑活动 SaaS 和门店营销。

---

# 十五、你当前项目最适合的架构

结合你的多门店奶茶项目，我建议你这样做：

```text
后端 zander-backend
负责：
- 动效配置
- 门店维度
- 商品维度
- 活动时间
- 优先级
- 状态控制

后台 zander-vue3-admin
负责：
- 动效配置 CRUD
- 选择适用场景
- 上传图片素材
- 设置活动时间
- 预览效果

小程序 zander-uniapp
负责：
- 根据 scene 拉取配置
- 渲染动画组件
- 判断设备性能
- 控制动画数量
- 执行业务交互动画
```

不要把“动画”当成纯前端问题。
对你的系统来说，它本质是：

```text
营销配置能力 + 前端渲染能力 + 场景挂载能力
```

这才是可以产品化的东西。

---

# 十六、最小可落地版本

你现在不要一下子做很大。
我建议先做这个 MVP：

```text
1. 小程序新增 animation 目录
2. 实现 ShineOverlay.vue
3. 实现 FestivalSticker.vue
4. 商品卡片支持 animation-layer
5. 写死一份 mock 动效配置
6. 实现按时间显示/隐藏
7. 再接后端接口
8. 后台最后补 CRUD
```

第一版 mock 配置：

```js
export const mockAnimationConfigs = [
  {
    id: 1,
    scene: "goods-card",
    type: "festival-sticker",
    enabled: true,
    startTime: "2026-05-01 00:00:00",
    endTime: "2026-05-31 23:59:59",
    priority: 10,
    property: {
      text: "520 第二杯半价",
      position: "top-right",
      animation: "shine",
      backgroundColor: "#ff4d6d",
      textColor: "#ffffff",
    },
  },
];
```

先证明小程序端渲染链路是通的，再做管理端和后端。

---

# 十七、最终判断

你要开发“流畅动画小程序”，不要只追求炫。正确路线是：

```text
CSS 动画打底
组件化承载
API 配置驱动
业务场景挂载
性能规则限制
管理端可配置
```

对你的奶茶店系统来说，最有价值的不是“写几个好看的动画”，而是做成：

```text
门店活动动效系统
商品营销贴片系统
节日广告自动投放系统
用户交互反馈系统
```

这会比单纯炫酷动画更有商业价值。
