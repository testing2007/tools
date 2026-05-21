const imageModules = [
  "/static/product/01.jpg",
  "/static/product/02.jpg",
  "/static/product/03.jpg",
  "/static/product/04.jpg",
  "/static/product/05.jpg",
  "/static/product/06.jpg",
  "/static/product/07.jpg",
  "/static/product/08.jpg",
  "/static/product/09.jpg",
  "/static/product/10.jpg"
];

export const mockProducts = imageModules.map((image, index) => ({
  id: `drink-${index + 1}`,
  name: [
    "云顶桂花奶青",
    "山茶冰萃",
    "鲜葡气泡茶",
    "椰乳抹茶拿铁",
    "茉莉青提轻乳",
    "柚见乌龙",
    "双倍芝士莓果",
    "焦糖海盐可可",
    "龙井鲜牛乳",
    "荔枝玫瑰冰茶"
  ][index],
  tag: ["新品", "人气", "轻负担", "季节限定", "门店推荐"][index % 5],
  desc: [
    "奶香柔和，尾调带一点花蜜感",
    "适合夏天的清爽型茶底",
    "入口有明显果香与气泡感",
    "抹茶和椰乳的顺滑组合",
    "青提果香突出，口感更轻盈",
    "酸甜平衡，乌龙回甘明显",
    "莓果风味浓郁，芝士感更足",
    "甜度克制，可可味干净",
    "适合喜欢茶感更重的人",
    "花果香型，冰饮表现更好"
  ][index],
  price: (15 + index * 2).toFixed(1),
  image
}));
