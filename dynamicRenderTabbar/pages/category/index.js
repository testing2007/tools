const { syncCurrentTab } = require('../../utils/tabbar-helper');

function buildCategoryData() {
  return Array.from({ length: 12 }, (_, parentIdx) => {
    const parentNo = parentIdx + 1;
    return {
      id: `cat-${parentNo}`,
      name: `Category ${parentNo}`,
      children: Array.from({ length: 22 }, (_, childIdx) => {
        const childNo = childIdx + 1;
        return {
          id: `cat-${parentNo}-sub-${childNo}`,
          title: `Subcategory ${parentNo}.${childNo}`,
          intro: `Belongs to Category ${parentNo}. This line is for long-scroll state testing.`,
          stats: `${10 + childNo} items`
        };
      })
    };
  });
}

Page({
  data: {
    parentList: [],
    activeParentIndex: 0,
    rightList: [],
    activeParentName: '',
    rightScrollTop: 0,
    rightScrollSnapshot: 0
  },

  onLoad() {
    const parentList = buildCategoryData();
    const activeParent = parentList[0] || { name: '', children: [] };
    this._rightScrollTopByParent = {};
    this.setData({
      parentList,
      activeParentIndex: 0,
      activeParentName: activeParent.name,
      rightList: activeParent.children,
      rightScrollTop: 0,
      rightScrollSnapshot: 0
    });
  },

  onShow() {
    syncCurrentTab(this);
  },

  onRightScroll(event) {
    const top = Math.floor(event.detail.scrollTop || 0);
    const index = this.data.activeParentIndex;
    this._rightScrollTopByParent[index] = top;

    if (Math.abs(top - this.data.rightScrollSnapshot) >= 80) {
      this.setData({
        rightScrollSnapshot: top
      });
    }
  },

  selectParent(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (index === this.data.activeParentIndex) {
      return;
    }

    const targetParent = this.data.parentList[index];
    if (!targetParent) {
      return;
    }

    const savedTop = this._rightScrollTopByParent[index] || 0;
    this.setData({
      activeParentIndex: index,
      activeParentName: targetParent.name,
      rightList: targetParent.children,
      rightScrollTop: savedTop,
      rightScrollSnapshot: savedTop
    });
  }
});