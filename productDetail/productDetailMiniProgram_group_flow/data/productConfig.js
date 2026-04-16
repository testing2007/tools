// productConfig.js  v9.0
// 新增：每个 group 可配置 transition 字段
//   - "snap"：全屏吸附切换（原行为）
//   - "flow"：与下一组连续滚动，无边界
//
// transition 控制的是「本组到下一组」的过渡方式
// 最后一组的 transition 无意义（没有下一组）

module.exports = {
  "groups": [
    {
      // snap: 组0滚到底后，弹簧吸附切到组1
      "transition": "snap",
      "images": [
        {
          "id": "img0",
          "src": "/assets/01.jpg",
          "overlays": [
            {
              "type": "tag",
              "pos": { "x": 3.3, "y": 46.3 },
              "dir": "left",
              "anim": {
                "type": "slideX_right",
                "startPos": 0.15,
                "endPos": 0.8
              },
              "style": {
                "color": "#111111",
                "fontSize": 37,
                "fontWeight": "700",
                "bgColor": null,
                "bgBlur": true,
                "boxShadow": false
              },
              "icon": "✨",
              "label": "全新型号"
            }
          ]
        },
        {
          "id": "img1",
          "src": "/assets/02.jpg",
          "overlays": [
            {
              "type": "card",
              "pos": { "x": 45.4, "y": 63.4 },
              "dir": "left",
              "anim": {
                "type": "fade",
                "startPos": 0.15,
                "endPos": 0.8
              },
              "style": {
                "color": "#111111",
                "fontSize": 28,
                "fontWeight": "700",
                "bgColor": "rgba(255,255,255,0.93)",
                "bgBlur": false,
                "boxShadow": false
              },
              "icon": "✨",
              "label": "新特性",
              "eyebrow": "精选功能",
              "title": "震撼视觉",
              "desc": "超越以往的美学方案"
            }
          ]
        }
      ]
    },
    {
      // flow: 组1和组2之间连续滚动，不吸附
      "transition": "flow",
      "images": [
        {
          "id": "img_v5c8",
          "src": "/assets/03.jpg",
          "overlays": [
            {
              "type": "tag",
              "pos": { "x": 5, "y": 15 },
              "dir": "left",
              "anim": {
                "type": "slideX_right",
                "startPos": 0.15,
                "endPos": 0.8
              },
              "style": {
                "color": "#111111",
                "fontSize": 28,
                "fontWeight": "700",
                "bgColor": "rgba(255,255,255,0.93)",
                "bgBlur": true,
                "boxShadow": true
              },
              "icon": "✨",
              "label": "新特性"
            }
          ]
        },
        {
          "id": "img_flow1",
          "src": "/assets/04.jpg",
          "overlays": []
        }
      ]
    },
    {
      "transition": "snap",
      "images": [
        {
          "id": "img_g3_0",
          "src": "/assets/05.jpg",
          "overlays": [
            {
              "type": "main",
              "pos": { "x": 10, "y": 30 },
              "dir": "left",
              "anim": {
                "type": "slideY",
                "startPos": 0.1,
                "endPos": 0.7
              },
              "style": {
                "color": "#ffffff",
                "fontSize": 32,
                "fontWeight": "800",
                "bgColor": "rgba(0,0,0,0.75)",
                "bgBlur": true,
                "boxShadow": true
              },
              "eyebrow": "旗舰系列",
              "title": "极致体验",
              "desc": "重新定义可能",
              "btnText": "立即了解"
            }
          ]
        }
      ]
    }
  ]
};