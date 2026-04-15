/**
 * 模拟来自 productConfig.js 的数据结构
 * 其中原来的 anim 字段被增强为了 scrollAnim，以支持滚动驱动
 */
const mockConfig = {
  "groups": [
    {
      "images": [
        {
          "id": "img0",
          "src": "https://picsum.photos/seed/picsum0/800/1200", 
          "overlays": [
            {
              "type": "tag",
              "pos": { "x": 10, "y": 20 },
              "scrollAnim": {
                // 进入视口 30% 开始动画，直到 55% 结束
                "triggerStart": 30,
                "triggerEnd": 55,
                "mapping": {
                  "translateX": [200, 0], // 从右边 200px 飞入
                  "opacity": [0, 1]
                }
              },
              "style": { "color": "#111111", "bgColor": "rgba(255,255,255,0.9)", "fontSize": "1.2rem" },
              "icon": "✨",
              "label": "全新型号"
            }
          ]
        },
        {
          "id": "img1",
          "src": "https://picsum.photos/seed/picsum1/800/1200",
          "overlays": [
            {
              "type": "card",
              "pos": { "x": 50, "y": 60 },
              "scrollAnim": {
                // 当滑动到视口 35% 时开始，60% 时结束
                "triggerStart": 35,
                "triggerEnd": 60,
                "mapping": {
                  "scale": [0.3, 1.0], // 从0.3倍放大到1倍
                  "opacity": [0, 1],
                  "translateY": [150, 0] // 伴随从下往上浮现
                }
              },
              "style": { "color": "#ffffff", "bgColor": "rgba(0,0,0,0.6)" },
              "icon": "🚀",
              "label": "震撼视觉",
              "eyebrow": "精选功能",
              "title": "超越以往的美学方案",
              "desc": "基于滚动驱动的动画，使用户可以完全掌控页面展现的节奏，随心所欲的前进或是回退。"
            }
          ]
        }
      ]
    },
    {
      "images": [
        {
          "id": "img2",
          "src": "https://picsum.photos/seed/picsum2/800/1200",
          "overlays": [
            {
              "type": "tag",
              "pos": { "x": 5, "y": 30 },
              "scrollAnim": {
                "triggerStart": 35,
                "triggerEnd": 60,
                "mapping": {
                  "translateX": [-100, 0], // 从左侧飞入
                  "rotate": [-45, 0],      // 附带旋转
                  "opacity": [0, 1]
                }
              },
              "style": { "color": "#111", "bgColor": "rgba(255,255,255,0.9)" },
              "icon": "⚡",
              "label": "快如闪电"
            }
          ]
        }
      ]
    }
  ]
};

// 页面初始化及渲染逻辑
document.addEventListener('DOMContentLoaded', () => {
  const outerTrack = document.getElementById('outer-track');
  
  // 根据数据生成 DOM 结构
  mockConfig.groups.forEach((group, gidx) => {
    
    // Group Screen (100vh height, acts as the slide for the outer track)
    const groupScreenEl = document.createElement('div');
    groupScreenEl.className = 'group-screen';

    // Group Content (the scrollable inner track)
    const groupContentEl = document.createElement('div');
    groupContentEl.className = 'group-content';
    groupContentEl.id = `gc-${gidx}`;

    group.images.forEach(imgData => {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'product-image-container';

      // 渲染背景图
      const imgEl = document.createElement('img');
      imgEl.className = 'product-bg-img';
      imgEl.src = imgData.src;
      imgEl.setAttribute('draggable', 'false'); // 防止原生拖拽图像
      imgContainer.appendChild(imgEl);

      // 渲染 Overlay
      if (imgData.overlays) {
        imgData.overlays.forEach(overlay => {
          const overlayEl = document.createElement('div');
          overlayEl.className = `overlay overlay-${overlay.type}`;
          
          overlayEl.style.left = `${overlay.pos.x}%`;
          overlayEl.style.top = `${overlay.pos.y}%`;
          
          if(overlay.type === 'card' && overlay.pos.x === 50) {
            overlayEl.style.transform = `translate(-50%, -50%)`; 
          }

          if (overlay.style) {
            if (overlay.style.color) overlayEl.style.color = overlay.style.color;
            if (overlay.style.bgColor) overlayEl.style.backgroundColor = overlay.style.bgColor;
            if (overlay.style.fontSize) overlayEl.style.fontSize = overlay.style.fontSize;
          }

          if (overlay.type === 'tag') {
            overlayEl.innerHTML = `<span class="icon">${overlay.icon || ''}</span><span class="label">${overlay.label}</span>`;
          } else if (overlay.type === 'card') {
            overlayEl.innerHTML = `
              <span class="eyebrow">${overlay.eyebrow}</span>
              <h3 class="title">${overlay.title}</h3>
              <p class="desc">${overlay.desc}</p>
            `;
          }

          // ===== 提取 ScrollAnim 数据，后续可以在 ScrollAnimator 中使用相对坐标 =====
          // 出于物理 POC 演示，主要展现了阻尼等交互，具体的相对进度条可以挂载
          if (overlay.scrollAnim) {
            overlayEl.dataset.animStart = overlay.scrollAnim.triggerStart;
            overlayEl.dataset.animEnd = overlay.scrollAnim.triggerEnd;
            overlayEl.dataset.mapping = JSON.stringify(overlay.scrollAnim.mapping);
            
            // 为了 POC 顺利跑起来演示组滑物理效果，我们临时记录
            overlayEl.classList.add('js-anim-element');
          }

          imgContainer.appendChild(overlayEl);
        });
      }

      groupContentEl.appendChild(imgContainer);
    });

    groupScreenEl.appendChild(groupContentEl);
    outerTrack.appendChild(groupScreenEl);
  });
  
  // 初始化双层坐标系 ScrollAnimator
  window.scroller = new ScrollAnimator();
});
