---
trigger: always_on
---

该workspace主要是完成产品详情页的滚动驱动动画前后端配置；


1. productDetailMiniProgram: 是小程序项目，根据数据进行渲染，数据来源一个模拟的json文件；实现按数据要求配置进行滚动驱动动画，

2. productDetailAdminEditor: 是vue实现配置管理页面，主要是来生成小程序端用到的 模拟json数据，导出的是 productConfig.js，其实就是json数据，只不过为了配合微信小程序的语法读写规则，使用了js命名，导出；

3. poc-scroll-animation: 你可以看成是一个网页端的一个测试项目；这个不是重点；