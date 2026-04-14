// 微信小程序 require() 不支持直接引入 .json，需用 module.exports 导出
// 此文件由 productConfig.json 转换而来，运行时通过 require('../../data/productConfig') 加载

module.exports = {
  "groups": [
    {
      "images": [
        {
          "id": "img0",
          "src": "/assets/01.jpg",
          "overlays": [
            {
              "type": "tag",
              "dir": "left",
              "anchor": "top-left",
              "icon": "✨",
              "label": "全新登场"
            }
          ]
        },
        {
          "id": "img1",
          "src": "/assets/02.jpg",
          "overlays": [
            {
              "type": "card",
              "dir": "right",
              "anchor": "mid-right",
              "eyebrow": "精选功能",
              "title": "震撼视觉",
              "desc": "超越以往的美学方案，带来极致体验"
            }
          ]
        },
        {
          "id": "img2",
          "src": "/assets/03.jpg",
          "overlays": [
            {
              "type": "tag",
              "dir": "bottom",
              "anchor": "bot-center",
              "icon": "🚀",
              "label": "性能狂飙"
            }
          ]
        }
      ]
    },
    {
      "images": [
        {
          "id": "img3",
          "src": "/assets/04.jpg",
          "overlays": [
            {
              "type": "card",
              "dir": "left",
              "anchor": "mid-left",
              "eyebrow": "核心优势",
              "title": "坚若磐石",
              "desc": "创新材料架构，经久耐用"
            }
          ]
        },
        {
          "id": "img4",
          "src": "/assets/05.jpg",
          "overlays": [
            {
              "type": "tag",
              "dir": "right",
              "anchor": "top-right",
              "icon": "🔋",
              "label": "持久续航"
            }
          ]
        },
        {
          "id": "img5",
          "src": "/assets/06.jpg",
          "overlays": [
            {
              "type": "main",
              "dir": "bottom",
              "anchor": "bot-center",
              "eyebrow": "立即了解",
              "title": "立即体验",
              "desc": "感受更多不凡之处",
              "btnText": "探索产品"
            }
          ]
        }
      ]
    }
  ]
};
