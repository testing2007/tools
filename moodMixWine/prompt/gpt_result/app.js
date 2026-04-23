const profiles = [
  {
    id: "midnight-cacao",
    nameCn: "午夜可可 · 轻酿版",
    nameEn: "Midnight Cacao Mild",
    shortName: "Midnight Cacao",
    direction: "Deep",
    rail: 34,
    railFill: 42,
    efi: 0.57,
    eii: 0.63,
    body: "Tight",
    summary: "紧绷被温柔包裹，像深夜里留给自己的最后一口回甘。",
    panelNote: "情绪色彩明显但仍可掌控。",
    note: "压力仍在，但你已经开始主动给自己留一点柔软的出口。",
    tags: ["中度酿制", "深色基酒", "紧绷"],
    colors: {
      accent: "#d7a06a",
      glow1: "#4f2333",
      glow2: "#c98049",
      glow3: "#8b9d88",
      liquidStart: "#3d1f2a",
      liquidEnd: "#b76f43",
      bottle: "linear-gradient(180deg, #6b2737 0%, #d89f69 100%)"
    },
    base: {
      name: "Deep Liquor",
      desc: "带一点沉稳与深色调。"
    },
    top: {
      name: "柠檬皮 · 迷迭香",
      desc: "来自你语句中的紧绷与急促。"
    },
    mid: {
      name: "可可 · 麦芽",
      desc: "来自你此刻的压力感。"
    },
    finish: {
      name: "橙皮",
      desc: "代表你想缓和的意图。"
    }
  },
  {
    id: "amber-hush",
    nameCn: "琥珀静语 · 慢酿版",
    nameEn: "Amber Hush Slow Brew",
    shortName: "Amber Hush",
    direction: "Calm",
    rail: 52,
    railFill: 56,
    efi: 0.34,
    eii: 0.48,
    body: "Soft",
    summary: "情绪像晚风拂过杯口，留下安静、克制又慢慢回暖的香气。",
    panelNote: "波动减弱，回甘开始靠近。",
    note: "你正在恢复秩序，连呼吸都比刚才更轻一些。",
    tags: ["低波动", "蜂蜜木香", "平静"],
    colors: {
      accent: "#dfb77c",
      glow1: "#6f493d",
      glow2: "#d89f63",
      glow3: "#8aa691",
      liquidStart: "#6a4337",
      liquidEnd: "#e0b16b",
      bottle: "linear-gradient(180deg, #8d5f45 0%, #e2ba78 100%)"
    },
    base: {
      name: "Oak Honey",
      desc: "温润木质感，像把情绪慢慢放下。"
    },
    top: {
      name: "佛手柑 · 梨花",
      desc: "来自你想让语气变柔和的那部分。"
    },
    mid: {
      name: "蜂蜜 · 烘麦",
      desc: "对应你正在回稳的心绪温度。"
    },
    finish: {
      name: "白茶",
      desc: "把尾调收成安静、清透的余韵。"
    }
  },
  {
    id: "citrus-comet",
    nameCn: "晨橘流星 · 亮调版",
    nameEn: "Citrus Comet Bright",
    shortName: "Citrus Comet",
    direction: "Bright",
    rail: 71,
    railFill: 74,
    efi: 0.62,
    eii: 0.54,
    body: "Lifted",
    summary: "轻快感重新浮上来，像一口带着气泡的晨光，把心情往上托了一寸。",
    panelNote: "亮度提升，情绪动能已经恢复。",
    note: "你在回到自己，甚至开始愿意把期待重新点亮。",
    tags: ["明亮", "果香", "轻气泡"],
    colors: {
      accent: "#f1b85d",
      glow1: "#7f4d23",
      glow2: "#f5aa45",
      glow3: "#7db1a0",
      liquidStart: "#cf7a2b",
      liquidEnd: "#f5d273",
      bottle: "linear-gradient(180deg, #f0a14d 0%, #f7df89 100%)"
    },
    base: {
      name: "Sparkling Citrus",
      desc: "轻盈的果香基底，让情绪先亮起来。"
    },
    top: {
      name: "橙花 · 葡萄柚皮",
      desc: "来自你语气里重新出现的轻快感。"
    },
    mid: {
      name: "金桔 · 雪松",
      desc: "把兴奋感压进更稳定的明亮结构里。"
    },
    finish: {
      name: "薄荷糖霜",
      desc: "让尾调保留一丝俏皮的清凉。"
    }
  }
];

const analysisLines = [
  "捕捉你的当下味道中…",
  "正在调和你的情绪基酒…",
  "听见语句里的细微颤动…",
  "让涟漪、浓度与回甘慢慢对齐…",
  "即将为你倒出本次情绪特调…"
];

const softLines = [
  "如果你愿意，我还可以继续听你说。",
  "先不用急着解释，呼吸会帮你把味道说完整。",
  "也许这不是脆弱，只是情绪在寻找出口。"
];

const historySeed = [
  {
    id: "seed-amber",
    profileId: "amber-hush",
    timestamp: "04/21 21:34",
    nameCn: "琥珀静语 · 慢酿版",
    summary: "情绪像晚风拂过杯口，留下安静、克制又慢慢回暖的香气。",
    note: "你正在恢复秩序，连呼吸都比刚才更轻一些。",
    tags: ["低波动", "平静", "蜂蜜木香"]
  },
  {
    id: "seed-citrus",
    profileId: "citrus-comet",
    timestamp: "04/20 23:08",
    nameCn: "晨橘流星 · 亮调版",
    summary: "轻快感重新浮上来，像一口带着气泡的晨光，把心情往上托了一寸。",
    note: "你在回到自己，甚至开始愿意把期待重新点亮。",
    tags: ["明亮", "轻气泡", "果香"]
  }
];

const root = document.documentElement;
const screens = [...document.querySelectorAll(".screen")];
const navButtons = [...document.querySelectorAll(".nav-button")];

const directionLabel = document.getElementById("direction-label");
const railDot = document.getElementById("rail-dot");
const railFill = document.getElementById("rail-fill");
const metricEfi = document.getElementById("metric-efi");
const metricEii = document.getElementById("metric-eii");
const metricBody = document.getElementById("metric-body");
const liquidBody = document.getElementById("liquid-body");
const mixCaption = document.getElementById("mix-caption");
const statusLine = document.getElementById("status-line");

const drinkNameCn = document.getElementById("drink-name-cn");
const drinkNameEn = document.getElementById("drink-name-en");
const drinkSummary = document.getElementById("drink-summary");
const labelName = document.getElementById("label-name");
const panelNote = document.getElementById("panel-note");
const bottleCore = document.getElementById("bottle-core");
const recipeBaseName = document.getElementById("recipe-base-name");
const recipeBaseDesc = document.getElementById("recipe-base-desc");
const recipeTopName = document.getElementById("recipe-top-name");
const recipeTopDesc = document.getElementById("recipe-top-desc");
const recipeMidName = document.getElementById("recipe-mid-name");
const recipeMidDesc = document.getElementById("recipe-mid-desc");
const recipeFinishName = document.getElementById("recipe-finish-name");
const recipeFinishDesc = document.getElementById("recipe-finish-desc");
const statIntensity = document.getElementById("stat-intensity");
const statDirection = document.getElementById("stat-direction");
const statState = document.getElementById("stat-state");

const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");
const historyLatest = document.getElementById("history-latest");
const historyNote = document.getElementById("history-note");

const startMixButton = document.getElementById("start-mix");
const continueTalkButton = document.getElementById("continue-talk");
const stopMixButton = document.getElementById("stop-mix");
const saveDrinkButton = document.getElementById("save-drink");
const shareCardButton = document.getElementById("share-card");
const remixDrinkButton = document.getElementById("remix-drink");
const softResetButton = document.getElementById("soft-reset");

let currentProfileIndex = 0;
let currentProfile = profiles[0];
let isMixing = false;
let mixTimer = null;
let mixLineIndex = 0;
let previewNudge = 0;
let historyEntries = [...historySeed];
let selectedHistoryId = historySeed[0].id;

function formatDirectionValue(value) {
  return (value / 100).toFixed(2);
}

function setTheme(profile) {
  root.style.setProperty("--accent", profile.colors.accent);
  root.style.setProperty("--glow-1", profile.colors.glow1);
  root.style.setProperty("--glow-2", profile.colors.glow2);
  root.style.setProperty("--glow-3", profile.colors.glow3);
  root.style.setProperty("--liquid-start", profile.colors.liquidStart);
  root.style.setProperty("--liquid-end", profile.colors.liquidEnd);
  root.style.setProperty("--bottle-fill", profile.colors.bottle);
}

function updateRail(rail, fill) {
  root.style.setProperty("--rail-position", `${rail}%`);
  root.style.setProperty("--rail-fill-stop", `${fill}%`);
  railDot.style.left = `${rail}%`;
  railFill.style.width = `${fill}%`;
}

function renderMix(profile) {
  setTheme(profile);
  updateRail(profile.rail, profile.railFill);
  directionLabel.textContent = `${profile.direction} / ${formatDirectionValue(profile.rail)}`;
  metricEfi.textContent = profile.efi.toFixed(2);
  metricEii.textContent = profile.eii.toFixed(2);
  metricBody.textContent = profile.body;
  mixCaption.textContent = isMixing ? analysisLines[mixLineIndex] : "捕捉你的当下味道中…";
  root.style.setProperty("--liquid-level", isMixing ? "74%" : "42%");
}

function renderResult(profile) {
  setTheme(profile);
  drinkNameCn.textContent = profile.nameCn;
  drinkNameEn.textContent = profile.nameEn;
  drinkSummary.textContent = profile.summary;
  labelName.textContent = profile.shortName;
  panelNote.textContent = profile.panelNote;
  recipeBaseName.textContent = profile.base.name;
  recipeBaseDesc.textContent = profile.base.desc;
  recipeTopName.textContent = profile.top.name;
  recipeTopDesc.textContent = profile.top.desc;
  recipeMidName.textContent = profile.mid.name;
  recipeMidDesc.textContent = profile.mid.desc;
  recipeFinishName.textContent = profile.finish.name;
  recipeFinishDesc.textContent = profile.finish.desc;
  statIntensity.textContent = profile.eii.toFixed(2);
  statDirection.textContent = profile.direction;
  statState.textContent = profile.body;
  bottleCore.style.background = profile.colors.bottle;
}

function renderHistory() {
  historyCount.textContent = String(historyEntries.length).padStart(2, "0");
  historyLatest.textContent = historyEntries[0] ? historyEntries[0].timestamp.split(" ")[1] : "--:--";

  historyList.innerHTML = historyEntries
    .map((entry) => {
      const selectedClass = entry.id === selectedHistoryId ? "history-card is-selected" : "history-card";
      return `
        <article class="${selectedClass}" data-entry-id="${entry.id}">
          <div class="history-card-top">
            <div>
              <p class="eyebrow">Emotional Pour</p>
              <h3>${entry.nameCn}</h3>
            </div>
            <time>${entry.timestamp}</time>
          </div>
          <p>${entry.summary}</p>
          <div class="history-tags">
            ${entry.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");

  const selectedEntry = historyEntries.find((entry) => entry.id === selectedHistoryId) || historyEntries[0];
  if (selectedEntry) {
    historyNote.innerHTML = `
      <p class="eyebrow">本次回甘</p>
      <h3>${selectedEntry.nameCn}</h3>
      <p>${selectedEntry.note}</p>
    `;
  }

  [...historyList.querySelectorAll(".history-card")].forEach((card) => {
    card.addEventListener("click", () => {
      selectedHistoryId = card.dataset.entryId;
      renderHistory();
    });
  });
}

function switchScreen(target) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === target);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.target === target);
  });
}

function resetMixVisuals() {
  clearInterval(mixTimer);
  isMixing = false;
  mixLineIndex = 0;
  startMixButton.textContent = "开始调制你的特调情绪饮品";
  statusLine.textContent = "正在调和你的情绪基酒…";
  mixCaption.textContent = "捕捉你的当下味道中…";
  root.style.setProperty("--liquid-level", "42%");
  renderMix(currentProfile);
}

function stepMixing(targetProfile) {
  const totalLines = analysisLines.length;
  const startRail = currentProfile.rail;
  const targetRail = targetProfile.rail;
  const startFill = currentProfile.railFill;
  const targetFill = targetProfile.railFill;
  const startEfi = currentProfile.efi;
  const targetEfi = targetProfile.efi;
  const startEii = currentProfile.eii;
  const targetEii = targetProfile.eii;

  mixTimer = setInterval(() => {
    mixLineIndex += 1;
    const progress = Math.min(mixLineIndex / totalLines, 1);
    const wobble = mixLineIndex === totalLines ? 0 : (Math.random() * 12) - 6;
    const nextRail = Math.max(16, Math.min(84, startRail + ((targetRail - startRail) * progress) + wobble));
    const nextFill = Math.max(20, Math.min(88, startFill + ((targetFill - startFill) * progress)));
    const nextEfi = startEfi + ((targetEfi - startEfi) * progress);
    const nextEii = startEii + ((targetEii - startEii) * progress);

    updateRail(nextRail, nextFill);
    directionLabel.textContent = `${targetProfile.direction} / ${formatDirectionValue(nextRail)}`;
    metricEfi.textContent = nextEfi.toFixed(2);
    metricEii.textContent = nextEii.toFixed(2);
    statusLine.textContent = analysisLines[Math.min(mixLineIndex, totalLines - 1)];
    mixCaption.textContent = analysisLines[Math.min(mixLineIndex, totalLines - 1)];

    if (mixLineIndex >= totalLines) {
      clearInterval(mixTimer);
      currentProfile = targetProfile;
      isMixing = false;
      renderMix(currentProfile);
      renderResult(currentProfile);
      statusLine.textContent = "特调完成，已为你装瓶。";
      mixCaption.textContent = "特调完成，已为你装瓶。";
      startMixButton.textContent = "开始下一杯情绪调制";

      window.setTimeout(() => {
        switchScreen("result");
      }, 360);
    }
  }, 1180);
}

function startMixing() {
  if (isMixing) {
    return;
  }

  const targetProfile = profiles[currentProfileIndex % profiles.length];
  currentProfileIndex += 1;
  previewNudge = 0;
  isMixing = true;
  mixLineIndex = 0;
  startMixButton.textContent = "调制进行中…";
  statusLine.textContent = analysisLines[0];
  mixCaption.textContent = analysisLines[0];
  root.style.setProperty("--liquid-level", "74%");
  setTheme(targetProfile);
  switchScreen("mix");
  stepMixing(targetProfile);
}

function continueTalk() {
  previewNudge += 1;
  const line = softLines[(previewNudge - 1) % softLines.length];
  statusLine.textContent = line;
  mixCaption.textContent = line;
  const previewProfile = profiles[(currentProfileIndex + previewNudge) % profiles.length];
  updateRail(previewProfile.rail, previewProfile.railFill);
  directionLabel.textContent = `${previewProfile.direction} / ${formatDirectionValue(previewProfile.rail)}`;
  metricEfi.textContent = previewProfile.efi.toFixed(2);
  metricEii.textContent = previewProfile.eii.toFixed(2);
  metricBody.textContent = previewProfile.body;
  setTheme(previewProfile);
}

function saveCurrentDrink() {
  const timestamp = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date()).replace(",", "");

  const entryId = `${currentProfile.id}-${Date.now()}`;
  historyEntries = [
    {
      id: entryId,
      profileId: currentProfile.id,
      timestamp,
      nameCn: currentProfile.nameCn,
      summary: currentProfile.summary,
      note: currentProfile.note,
      tags: currentProfile.tags
    },
    ...historyEntries
  ];
  selectedHistoryId = entryId;
  renderHistory();
  switchScreen("history");
  saveDrinkButton.textContent = "已保存到酒单";

  window.setTimeout(() => {
    saveDrinkButton.textContent = "保存到酒单";
  }, 1400);
}

async function shareCurrentDrink() {
  const shareText = `${currentProfile.nameCn}\n${currentProfile.nameEn}\n${currentProfile.summary}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
      shareCardButton.textContent = "文案已复制";
    } else {
      shareCardButton.textContent = "可分享文案已准备";
    }
  } catch (error) {
    shareCardButton.textContent = "分享稍后再试";
  }

  window.setTimeout(() => {
    shareCardButton.textContent = "分享卡片";
  }, 1400);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchScreen(button.dataset.target);
  });
});

startMixButton.addEventListener("click", startMixing);
continueTalkButton.addEventListener("click", continueTalk);
stopMixButton.addEventListener("click", resetMixVisuals);
remixDrinkButton.addEventListener("click", () => {
  resetMixVisuals();
  switchScreen("mix");
});
saveDrinkButton.addEventListener("click", saveCurrentDrink);
shareCardButton.addEventListener("click", shareCurrentDrink);
softResetButton.addEventListener("click", () => {
  currentProfileIndex = 0;
  currentProfile = profiles[0];
  previewNudge = 0;
  selectedHistoryId = historySeed[0].id;
  historyEntries = [...historySeed];
  renderMix(currentProfile);
  renderResult(currentProfile);
  renderHistory();
  resetMixVisuals();
  switchScreen("mix");
});

renderMix(currentProfile);
renderResult(currentProfile);
renderHistory();
