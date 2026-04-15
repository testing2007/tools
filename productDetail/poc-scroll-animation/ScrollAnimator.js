/**
 * Two-Tier Scroll Animator (双层虚拟滚动引擎)
 * 完美还原小程序 index.wxml 中外层翻页 + 内层自由滚动的方案。
 * - 外层 (Outer Track)：负责组与组边界的弹簧阻尼与翻页。
 * - 内层 (Inner Track)：负责组内的图片浏览（完全自由的物理丝滑滑动，无阻力）。
 */

class ScrollAnimator {
  constructor() {
    // 外层组 (Section Paging)
    this.currentGroupIndex = -1; // -1 代表处于顶部的 Header 封面区块
    this.totalGroups = 0;
    this.targetOuterY = 0;
    this.currentOuterY = 0;
    
    // 内层组 (Inner Free Scroll)
    this.innerScrollState = {}; 
    
    this.isDragging = false;
    this.startY = 0;
    this.damping = 0.10; // 稍微增加硬度，使物理回弹更果断不肉
    this.SHIFT_THRESHOLD = 40; // 降低翻页门槛，使切换大组更灵敏

    this.onWheel = this.onWheel.bind(this);
    this.onPointerStart = this.onPointerStart.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onResize = this.onResize.bind(this);
    this.tick = this.tick.bind(this);

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('mousedown', this.onPointerStart, { passive: false });
    window.addEventListener('mousemove', this.onPointerMove, { passive: false });
    window.addEventListener('mouseup', this.onPointerEnd);
    window.addEventListener('mouseleave', this.onPointerEnd);
    window.addEventListener('touchstart', (e) => this.onPointerStart(e.touches[0]), { passive: false });
    window.addEventListener('touchmove', (e) => this.onPointerMove(e.touches[0], e), { passive: false });
    window.addEventListener('touchend', this.onPointerEnd);
    
    // Resize 需要监听图片加载完毕
    window.addEventListener('resize', this.onResize);
    window.addEventListener('load', this.onResize);
    
    // 监听 dom 变化 (处理动态图片插入)
    const observer = new MutationObserver(this.onResize);
    observer.observe(document.body, { childList: true, subtree: true });

    this.onResize();
    requestAnimationFrame(this.tick);
  }

  onResize() {
    this.header = document.querySelector('.page-header');
    this.scroller = document.getElementById('scroller');
    
    const groupScreens = document.querySelectorAll('.group-screen');
    this.totalGroups = groupScreens.length;
    
    this.innerScrollState[-1] = { targetY: 0, currentY: 0, maxScroll: 0 }; 
    
    groupScreens.forEach((gEl, idx) => {
       const content = gEl.querySelector('.group-content');
       // 修复：如果内部没有足够高，就不允许滚动
       let contentH = content ? content.scrollHeight : 0;
       let maxScroll = contentH - window.innerHeight;
       if (maxScroll < 0) maxScroll = 0;
       
       this.innerScrollState[idx] = { 
           targetY: this.innerScrollState[idx]?.targetY || 0, 
           currentY: this.innerScrollState[idx]?.currentY || 0,
           maxScroll: maxScroll 
       };
    });
    
    this.snapToCurrentGroup();
  }

  onWheel(e) {
    if (e.cancelable) e.preventDefault();
    this.isDragging = false; 
    
    // trackpad 平滑位移
    this.processDelta(e.deltaY);
    
    clearTimeout(this.wheelSnapTimer);
    this.wheelSnapTimer = setTimeout(() => this.onInteractionEnd(), 150);
  }

  onPointerStart(e) {
    if (e.button === 2) return; 
    this.isDragging = true;
    this.startY = e.clientY;
    
    this.targetOuterY = this.currentOuterY;
    const inner = this.innerScrollState[this.currentGroupIndex];
    if (inner) inner.targetY = inner.currentY;
  }

  onPointerMove(e, originalEvent) {
    if (!this.isDragging) return;
    if (originalEvent && originalEvent.type === 'mousemove' && originalEvent.buttons === 0) {
      this.onPointerEnd(); return;
    }
    if (originalEvent && originalEvent.cancelable) originalEvent.preventDefault(); 
    
    const deltaY = this.startY - e.clientY; 
    this.startY = e.clientY; 
    
    this.processDelta(deltaY);
  }

  onPointerEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.onInteractionEnd();
  }

  processDelta(deltaY) {
    const inner = this.innerScrollState[this.currentGroupIndex];
    if (!inner) return;

    inner.targetY += deltaY;

    if (inner.targetY < 0) {
      const overscroll = inner.targetY;
      inner.targetY = 0; 
      this.targetOuterY += overscroll * 0.4; 
    } 
    else if (inner.targetY > inner.maxScroll) {
      const overscroll = inner.targetY - inner.maxScroll;
      inner.targetY = inner.maxScroll;
      this.targetOuterY += overscroll * 0.4;
    }
  }

  onInteractionEnd() {
    const anchorY = this.getGroupAnchor(this.currentGroupIndex);
    const outerDiff = this.targetOuterY - anchorY;
    
    // 允许通过拉扯意图进行翻页
    if (outerDiff > this.SHIFT_THRESHOLD) {
       this.currentGroupIndex = Math.min(this.currentGroupIndex + 1, this.totalGroups - 1);
       if (this.innerScrollState[this.currentGroupIndex]) {
           this.innerScrollState[this.currentGroupIndex].targetY = 0;
       }
    } else if (outerDiff < -this.SHIFT_THRESHOLD) {
       this.currentGroupIndex = Math.max(this.currentGroupIndex - 1, -1);
       if (this.currentGroupIndex !== -1 && this.innerScrollState[this.currentGroupIndex]) {
           this.innerScrollState[this.currentGroupIndex].targetY = this.innerScrollState[this.currentGroupIndex].maxScroll;
       }
    }
    
    this.snapToCurrentGroup();
  }

  getGroupAnchor(index) {
    if (index === -1) return 0;
    return (index + 1) * window.innerHeight;
  }

  snapToCurrentGroup() {
    this.targetOuterY = this.getGroupAnchor(this.currentGroupIndex);
  }

  tick() {
    this.currentOuterY += (this.targetOuterY - this.currentOuterY) * this.damping;

    Object.keys(this.innerScrollState).forEach(key => {
       const state = this.innerScrollState[key];
       state.currentY += (state.targetY - state.currentY) * 0.15;
    });

    if (this.scroller) {
      this.scroller.style.transform = `translateY(${-this.currentOuterY}px)`;
    }

    // 更新各内部轨道
    for (let i = 0; i < this.totalGroups; i++) {
        const content = document.getElementById(`gc-${i}`);
        if (content && this.innerScrollState[i]) {
            content.style.transform = `translateY(${-this.innerScrollState[i].currentY}px)`;
        }
    }

    this.renderElementContextAnimations();
    requestAnimationFrame(this.tick);
  }

  // --- 基于 Element Context 的真理渲染引擎 (基于物体相对视口的实时位置) ---
  renderElementContextAnimations() {
    const animElements = document.querySelectorAll('.js-anim-element');
    const vH = window.innerHeight;

    animElements.forEach(el => {
       const container = el.closest('.product-image-container');
       if (!container) return;

       const rect = container.getBoundingClientRect();
       
       // 改进：增加安全边际，只有在容器进入或靠近视口时才进行昂贵的 CSS 更新
       if (rect.bottom < -100 || rect.top > vH + 100) return;

       // progressPercent 定义：
       // 0%   = 容器顶部刚进入视口底部 (rect.top == vH)
       // 100% = 容器底部刚离开视口顶部 (rect.bottom == 0)
       const totalTravel = vH + rect.height;
       const currentTravel = vH - rect.top;
       
       const progressPercent = (currentTravel / totalTravel) * 100;
       
       const start = parseFloat(el.dataset.animStart);
       const end = parseFloat(el.dataset.animEnd);
       const mappingData = el.dataset.mapping;
       if (!mappingData) return;
       const mapping = JSON.parse(mappingData);

       let ratio = 0;
       if (progressPercent <= start) ratio = 0;
       else if (progressPercent >= end) ratio = 1;
       else ratio = (progressPercent - start) / (end - start);

       let transformStr = '';
       for (let prop in mapping) {
          const [sVal, eVal] = mapping[prop];
          const cVal = sVal + (eVal - sVal) * ratio;
          if (prop === 'opacity') el.style.opacity = cVal;
          else if (prop === 'scale') transformStr += `scale(${cVal}) `;
          else if (prop === 'translateX') transformStr += `translateX(${cVal}px) `;
          else if (prop === 'translateY') transformStr += `translateY(${cVal}px) `;
          else if (prop === 'rotate') transformStr += `rotate(${cVal}deg) `;
       }

       if (transformStr) {
          if (el.classList.contains('overlay-card')) {
              el.style.transform = `translate(-50%, -50%) ` + transformStr.trim();
          } else {
              el.style.transform = transformStr.trim();
          }
       }
    });
  }
}
