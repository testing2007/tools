<template>
  <view />
</template>

<style lang="scss">
@use "./styles/common.scss" as *;

page {
  min-height: 100%;
  background: #f6f3ee;
  color: #2f241f;
  font-family:
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    sans-serif;
}

view,
text,
button,
image {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  line-height: 1;
  background: transparent;
}

button::after {
  border: 0;
}

</style>
