// 白酒小程序首页 Figma 构建脚本
// 用法：在 Figma MCP 恢复可用后，通过 use_figma 执行这份脚本中的主体逻辑。
// 说明：这里优先把页面结构、配色、层级关系和关键文案固化下来，方便后续继续自动生成。

const COLORS = {
  bg: { r: 7 / 255, g: 17 / 255, b: 26 / 255 },
  bgSoft: { r: 14 / 255, g: 26 / 255, b: 36 / 255 },
  bgDeep: { r: 3 / 255, g: 8 / 255, b: 13 / 255 },
  card: { r: 246 / 255, g: 235 / 255, b: 216 / 255 },
  gold: { r: 216 / 255, g: 168 / 255, b: 91 / 255 },
  goldSoft: { r: 246 / 255, g: 216 / 255, b: 153 / 255 },
  goldDark: { r: 138 / 255, g: 90 / 255, b: 36 / 255 },
  red: { r: 142 / 255, g: 36 / 255, b: 27 / 255 },
  redDark: { r: 92 / 255, g: 21 / 255, b: 18 / 255 },
  textLight: { r: 248 / 255, g: 232 / 255, b: 200 / 255 },
  textSubtle: { r: 191 / 255, g: 167 / 255, b: 122 / 255 },
  textDark: { r: 43 / 255, g: 26 / 255, b: 18 / 255 },
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
};

const FONT_SERIF = { family: "Noto Serif SC", style: "SemiBold" };
const FONT_SANS = { family: "Inter", style: "Regular" };
const FONT_SANS_MEDIUM = { family: "Inter", style: "Medium" };
const FONT_SANS_BOLD = { family: "Inter", style: "Bold" };

async function loadFonts() {
  await figma.loadFontAsync(FONT_SERIF);
  await figma.loadFontAsync(FONT_SANS);
  await figma.loadFontAsync(FONT_SANS_MEDIUM);
  await figma.loadFontAsync(FONT_SANS_BOLD);
}

function solid(color, opacity = 1) {
  return { type: "SOLID", color, opacity };
}

function linearGradient(stops) {
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    gradientStops: stops,
  };
}

function addShadow(node, color = COLORS.black, opacity = 0.35, blur = 32, y = 14) {
  node.effects = [
    {
      type: "DROP_SHADOW",
      color: { ...color, a: opacity },
      offset: { x: 0, y },
      radius: blur,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
}

function makeText(name, content, fontName, fontSize, color) {
  const node = figma.createText();
  node.name = name;
  node.fontName = fontName;
  node.characters = content;
  node.fontSize = fontSize;
  node.fills = [solid(color)];
  return node;
}

function makeFrame(name, width, height) {
  const node = figma.createFrame();
  node.name = name;
  node.resize(width, height);
  node.fills = [];
  node.strokes = [];
  return node;
}

function makeRoundedRect(name, width, height, fillColor, radius = 0) {
  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(width, height);
  rect.fills = [solid(fillColor)];
  rect.cornerRadius = radius;
  return rect;
}

function makeIconBadge(name, label) {
  const item = makeFrame(name, 74, 70);
  item.layoutMode = "VERTICAL";
  item.primaryAxisSizingMode = "AUTO";
  item.counterAxisSizingMode = "FIXED";
  item.counterAxisAlignItems = "CENTER";
  item.itemSpacing = 10;
  item.fills = [];

  const iconBox = makeRoundedRect(`${name}/icon`, 36, 36, COLORS.bgSoft, 12);
  iconBox.strokes = [solid(COLORS.gold, 0.4)];
  iconBox.strokeWeight = 1;
  const iconMark = makeText(`${name}/mark`, "✦", FONT_SANS_BOLD, 16, COLORS.gold);
  iconMark.x = 11;
  iconMark.y = 8;
  iconBox.appendChild(iconMark);

  const text = makeText(`${name}/text`, label, FONT_SANS_MEDIUM, 11, COLORS.textDark);
  text.textAlignHorizontal = "CENTER";

  item.appendChild(iconBox);
  item.appendChild(text);
  return item;
}

function makeProductCard(name, title, subtitle, price, bottleLabel) {
  const card = makeFrame(name, 163, 214);
  card.cornerRadius = 18;
  card.clipsContent = true;
  card.fills = [solid(COLORS.card)];
  addShadow(card, COLORS.black, 0.18, 18, 8);

  const imageArea = makeFrame(`${name}/image`, 163, 126);
  imageArea.fills = [linearGradient([
    { position: 0, color: { ...COLORS.bgSoft, a: 1 } },
    { position: 1, color: { ...COLORS.bgDeep, a: 1 } },
  ])];

  const mist = makeRoundedRect(`${name}/mist`, 120, 38, COLORS.white, 999);
  mist.opacity = 0.06;
  mist.rotation = -8;
  mist.x = 20;
  mist.y = 76;
  imageArea.appendChild(mist);

  const bottle = makeRoundedRect(`${name}/bottle`, 36, 84, COLORS.bg, 12);
  bottle.strokes = [solid(COLORS.gold, 0.5)];
  bottle.strokeWeight = 1.2;
  bottle.x = 50;
  bottle.y = 22;
  const bottleCap = makeRoundedRect(`${name}/cap`, 20, 12, COLORS.gold, 10);
  bottleCap.x = 58;
  bottleCap.y = 14;
  const bottleTag = makeText(`${name}/tag`, bottleLabel, FONT_SERIF, 11, COLORS.goldSoft);
  bottleTag.rotation = 90;
  bottleTag.x = 70;
  bottleTag.y = 42;
  imageArea.appendChild(bottle);
  imageArea.appendChild(bottleCap);
  imageArea.appendChild(bottleTag);

  const body = makeFrame(`${name}/body`, 163, 88);
  body.x = 0;
  body.y = 126;
  body.fills = [];

  const titleNode = makeText(`${name}/title`, title, FONT_SANS_MEDIUM, 12, COLORS.textDark);
  titleNode.x = 12;
  titleNode.y = 10;
  const subNode = makeText(`${name}/sub`, subtitle, FONT_SANS, 11, COLORS.textSubtle);
  subNode.x = 12;
  subNode.y = 30;
  const priceNode = makeText(`${name}/price`, price, FONT_SANS_BOLD, 28, COLORS.red);
  priceNode.x = 12;
  priceNode.y = 48;

  const cart = makeRoundedRect(`${name}/cart`, 26, 26, COLORS.bgSoft, 13);
  cart.x = 126;
  cart.y = 50;
  cart.strokes = [solid(COLORS.gold, 0.4)];
  cart.strokeWeight = 1;
  const cartMark = makeText(`${name}/cartMark`, "🛒", FONT_SANS, 12, COLORS.gold);
  cartMark.x = 5;
  cartMark.y = 5;
  cart.appendChild(cartMark);

  body.appendChild(titleNode);
  body.appendChild(subNode);
  body.appendChild(priceNode);
  body.appendChild(cart);

  card.appendChild(imageArea);
  card.appendChild(body);
  return card;
}

async function buildHomepage() {
  await loadFonts();

  const page = figma.root.children[0];
  await figma.setCurrentPageAsync(page);
  page.name = "首页设计";
  page.backgrounds = [solid(COLORS.bgDeep)];

  // 把新画板放到右侧，避免和 Figma 默认内容重叠。
  let maxX = 0;
  for (const child of page.children) {
    maxX = Math.max(maxX, child.x + child.width);
  }

  const phone = makeFrame("白酒商城-首页", 375, 812);
  phone.x = maxX + 200;
  phone.y = 80;
  phone.cornerRadius = 40;
  phone.clipsContent = true;
  phone.fills = [linearGradient([
    { position: 0, color: { ...COLORS.bg, a: 1 } },
    { position: 0.45, color: { ...COLORS.bgSoft, a: 1 } },
    { position: 1, color: { ...COLORS.bgDeep, a: 1 } },
  ])];
  addShadow(phone, COLORS.black, 0.42, 44, 18);
  page.appendChild(phone);

  const safeTop = 44;
  const content = makeFrame("内容区", 375, 812);
  content.fills = [];
  phone.appendChild(content);

  const title = makeText("标题", "首页", FONT_SERIF, 18, COLORS.textLight);
  title.x = 173;
  title.y = 26;
  content.appendChild(title);

  const menu = makeRoundedRect("菜单胶囊", 72, 32, COLORS.bgSoft, 16);
  menu.x = 287;
  menu.y = 22;
  menu.opacity = 0.75;
  menu.strokes = [solid(COLORS.gold, 0.35)];
  menu.strokeWeight = 1;
  content.appendChild(menu);

  const dotText = makeText("菜单点", "•••   ○", FONT_SANS_BOLD, 14, COLORS.textLight);
  dotText.x = 304;
  dotText.y = 30;
  content.appendChild(dotText);

  const search = makeRoundedRect("搜索框", 327, 40, COLORS.white, 20);
  search.x = 24;
  search.y = safeTop + 22;
  search.opacity = 0.12;
  search.strokes = [solid(COLORS.gold, 0.18)];
  search.strokeWeight = 1;
  content.appendChild(search);

  const searchLabel = makeText("搜索文案", "🔍  搜索商品、品牌、酒款", FONT_SANS, 12, COLORS.textSubtle);
  searchLabel.x = 40;
  searchLabel.y = safeTop + 34;
  content.appendChild(searchLabel);

  const hero = makeRoundedRect("Hero", 343, 180, COLORS.bgSoft, 28);
  hero.x = 16;
  hero.y = 136;
  hero.fills = [linearGradient([
    { position: 0, color: { ...COLORS.bgSoft, a: 1 } },
    { position: 1, color: { ...COLORS.bgDeep, a: 1 } },
  ])];
  hero.strokes = [solid(COLORS.gold, 0.25)];
  hero.strokeWeight = 1;
  addShadow(hero, COLORS.black, 0.24, 26, 10);
  content.appendChild(hero);

  const glow = makeRoundedRect("Hero光晕", 140, 140, COLORS.gold, 70);
  glow.opacity = 0.09;
  glow.x = 212;
  glow.y = 26;
  hero.appendChild(glow);

  const heroTitle1 = makeText("Hero标题1", "时光酿礼", FONT_SERIF, 22, COLORS.goldSoft);
  heroTitle1.x = 18;
  heroTitle1.y = 28;
  hero.appendChild(heroTitle1);
  const heroTitle2 = makeText("Hero标题2", "匠心如初", FONT_SERIF, 22, COLORS.goldSoft);
  heroTitle2.x = 18;
  heroTitle2.y = 58;
  hero.appendChild(heroTitle2);
  const heroSub = makeText("Hero副标题", "国态纯酿 · 美酒天成", FONT_SANS_MEDIUM, 12, COLORS.textLight);
  heroSub.x = 18;
  heroSub.y = 96;
  hero.appendChild(heroSub);

  const cta = makeRoundedRect("CTA", 86, 30, COLORS.goldSoft, 999);
  cta.x = 18;
  cta.y = 124;
  content.appendChild(cta);
  const ctaLabel = makeText("CTA文案", "探索更多", FONT_SANS_BOLD, 12, COLORS.textDark);
  ctaLabel.x = 36;
  ctaLabel.y = 267;
  content.appendChild(ctaLabel);

  const bottleBox = makeRoundedRect("瓶身", 46, 112, COLORS.bg, 16);
  bottleBox.x = 246;
  bottleBox.y = 160;
  bottleBox.strokes = [solid(COLORS.gold, 0.45)];
  bottleBox.strokeWeight = 1.3;
  content.appendChild(bottleBox);
  const cap = makeRoundedRect("瓶盖", 26, 18, COLORS.gold, 12);
  cap.x = 256;
  cap.y = 145;
  content.appendChild(cap);
  const pack = makeRoundedRect("礼盒", 64, 120, COLORS.bg, 12);
  pack.x = 288;
  pack.y = 154;
  pack.strokes = [solid(COLORS.gold, 0.32)];
  pack.strokeWeight = 1.2;
  content.appendChild(pack);

  const quickPanel = makeRoundedRect("金刚区背景", 343, 118, COLORS.card, 22);
  quickPanel.x = 16;
  quickPanel.y = 332;
  addShadow(quickPanel, COLORS.black, 0.15, 18, 6);
  content.appendChild(quickPanel);

  const quickGrid = makeFrame("金刚区", 311, 90);
  quickGrid.x = 32;
  quickGrid.y = 346;
  quickGrid.layoutMode = "HORIZONTAL";
  quickGrid.layoutWrap = "WRAP";
  quickGrid.primaryAxisSizingMode = "FIXED";
  quickGrid.counterAxisSizingMode = "AUTO";
  quickGrid.itemSpacing = 8;
  quickGrid.counterAxisSpacing = 8;
  quickGrid.fills = [];
  const menuItems = ["名酒甄选", "礼盒专区", "会员专享", "收藏佳酿", "淘饮送礼", "企业团购", "品牌故事", "酒文化"];
  for (const item of menuItems) {
    quickGrid.appendChild(makeIconBadge(`入口/${item}`, item));
  }
  content.appendChild(quickGrid);

  const sectionTitle = makeText("推荐标题", "为您推荐", FONT_SERIF, 18, COLORS.textDark);
  sectionTitle.x = 20;
  sectionTitle.y = 472;
  content.appendChild(sectionTitle);
  const more = makeText("查看更多", "查看更多 >", FONT_SANS_MEDIUM, 12, COLORS.textSubtle);
  more.x = 288;
  more.y = 476;
  content.appendChild(more);

  const cardsRow = makeFrame("推荐商品", 343, 214);
  cardsRow.x = 16;
  cardsRow.y = 510;
  cardsRow.layoutMode = "HORIZONTAL";
  cardsRow.itemSpacing = 12;
  cardsRow.fills = [];
  cardsRow.appendChild(makeProductCard("推荐卡1", "典藏 · 年份窖藏", "53%vol", "¥598", "贡"));
  cardsRow.appendChild(makeProductCard("推荐卡2", "臻品 · 大师酿造", "52%vol", "¥418", "藏"));
  content.appendChild(cardsRow);

  const tabbar = makeRoundedRect("底部导航", 375, 84, COLORS.card, 26);
  tabbar.x = 0;
  tabbar.y = 728;
  tabbar.opacity = 0.98;
  content.appendChild(tabbar);

  const tabItems = [
    { label: "首页", active: true },
    { label: "分类", active: false },
    { label: "发现", active: false },
    { label: "购物车", active: false },
    { label: "我的", active: false },
  ];
  const startX = 30;
  tabItems.forEach((item, index) => {
    const x = startX + index * 68;
    const icon = makeText(`Tab/${item.label}/icon`, item.active ? "⬟" : "◻", FONT_SANS_BOLD, 16, item.active ? COLORS.red : COLORS.textSubtle);
    icon.x = x + 10;
    icon.y = 744;
    content.appendChild(icon);

    const label = makeText(`Tab/${item.label}/text`, item.label, FONT_SANS_MEDIUM, 11, item.active ? COLORS.red : COLORS.textSubtle);
    label.x = x;
    label.y = 768;
    content.appendChild(label);
  });

  return {
    createdNodeIds: [phone.id, content.id, hero.id, quickPanel.id, cardsRow.id, tabbar.id],
    mutatedNodeIds: [page.id],
  };
}

return await buildHomepage();
