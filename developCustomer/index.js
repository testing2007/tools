const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ===== 配置区域 =====
const CONFIG = {
  GROUP_URL: 'https://www.facebook.com/groups/543140544013409',
  STATE_FILE: 'fb_state.json',
  OUTPUT_FILE: 'leads_output.json',

  SCROLL_TIMES: 5,        // 滚动次数
  SCROLL_DELAY: 3000,      // 每次滚动后等待(ms)
  PAGE_TIMEOUT: 60000,

  // 排除的 profile_name 列表
  EXCLUDE_PROFILES: [
    'Truck Parts Supplier - Clutch Parts'
  ],

  // ===== 关键词（英文 + 越南语 + 西语 + 中文）=====
  KEYWORDS: [

    // ===== 英文（采购意图 + 热门配件）=====
    'jmc',
    'jmc spare parts', 'spare parts',
    'jmc auto parts', 'auto parts',
    'jmc parts supplier', 'parts supplier',
    'jmc parts price', 'parts price',
    'jmc parts catalog', 'parts catalog',

    // 热门配件（重点）
    'jmc engine', 'engine',
    'jmc gearbox', 'gearbox',
    'jmc transmission', 'transmission',
    'jmc turbocharger', 'turbocharger',
    'jmc fuel injector', 'fuel injector',
    'jmc fuel pump', 'fuel pump',
    'jmc clutch kit', 'clutch kit',
    'jmc brake pad', 'brake pad',
    'jmc brake disc', 'brake disc',
    'jmc radiator', 'radiator',
    'jmc alternator', 'alternator',
    'jmc starter motor', 'starter motor',
    'jmc suspension parts', 'suspension parts',
    'jmc shock absorber', 'shock absorber',
    'jmc steering rack', 'steering rack',
    'jmc axle', 'axle',
    'jmc leaf spring', 'leaf spring',

    // 采购意图
    'need',
    'looking for',
    'buy',
    'urgent',
    'inquiry',
    'quote',

    // ===== 越南语（重点市场）=====
    'phụ tùng jmc', 'phụ tùng',
    'linh kiện jmc', 'linh kiện',
    'cần mua phụ tùng jmc', 'cần mua',
    'tìm mua phụ tùng jmc', 'tìm mua',
    'báo giá phụ tùng jmc', 'báo giá',
    'nhà cung cấp phụ tùng jmc', 'nhà cung cấp',

    // 具体配件
    'động cơ jmc', 'động cơ',        // engine
    'hộp số jmc', 'hộp số',        // gearbox
    'kim phun jmc', 'kim phun',      // injector
    'bơm nhiên liệu jmc', 'bơm nhiên liệu',// fuel pump
    'turbo jmc', 'turbo',
    'má phanh jmc', 'má phanh',      // brake pad
    'giảm xóc jmc', 'giảm xóc',      // shock absorber
    'két nước jmc', 'két nước',      // radiator

    // ===== 西班牙语（拉美市场）=====
    'repuestos jmc', 'repuestos',
    'autopartes jmc', 'autopartes',
    'proveedor jmc', 'proveedor',
    'precio repuestos jmc', 'precio repuestos',
    'cotización jmc', 'cotización',

    // 具体配件
    'motor jmc', 'motor',
    'caja de cambios jmc', 'caja de cambios',
    'inyector jmc', 'inyector',
    'bomba de combustible jmc', 'bomba de combustible',
    'turbo jmc', 'turbo',
    'pastillas de freno jmc', 'pastillas de freno',
    'amortiguador jmc', 'amortiguador'
  ]
};

// ===== 工具函数 =====

function getMatchedKeyword(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  return CONFIG.KEYWORDS.find(kw => lower.includes(kw.toLowerCase())) || null;
}

function saveResults(leads) {
  const outputPath = path.resolve(CONFIG.OUTPUT_FILE);
  const data = {
    crawledAt: new Date().toISOString(),
    total: leads.length,
    groupUrl: CONFIG.GROUP_URL,
    leads: leads
  };
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n💾 结果已保存到: ${outputPath}`);
}

function waitForEnter(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.once('data', resolve);
  });
}

// ===== 主逻辑 =====
(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const hasState = fs.existsSync(CONFIG.STATE_FILE);
  let stateData = undefined;
  if (hasState) {
    try {
      const raw = fs.readFileSync(CONFIG.STATE_FILE, 'utf-8').trim();
      if (raw && raw !== '{}' && raw !== '') {
        stateData = JSON.parse(raw);
        // 验证 state 结构合法
        if (!stateData.cookies || !Array.isArray(stateData.cookies) || stateData.cookies.length === 0) {
          stateData = undefined;
        }
      }
    } catch (e) {
      stateData = undefined;
    }
  }

  const context = await browser.newContext({
    storageState: stateData || undefined,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT);

  // 将浏览器中的 console.log 转发到 Node.js 终端
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log(`[浏览器] ${msg.text()}`);
    }
  });

  // ===== 登录流程 =====
  try {
    await page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.PAGE_TIMEOUT
    });
    await page.waitForTimeout(3000);

    // 多种方式检测是否已登录
    const currentUrl = page.url();
    const hasLoginForm = await page.$('form#login_form, input[name="email"], #loginbutton');
    const hasLoggedInNav = await page.$('[aria-label="你的个人主页"], [aria-label="Your profile"], [aria-label="Facebook"], [role="navigation"]');

    const isOnLoginPage = currentUrl.includes('login') || currentUrl.includes('checkpoint') || hasLoginForm;

    if (isOnLoginPage || !hasLoggedInNav) {
      console.log('\n👉 请在浏览器中手动完成 Facebook 登录...');
      await waitForEnter('   登录完成后按回车继续...\n');
      await context.storageState({ path: CONFIG.STATE_FILE });
      console.log('✅ 登录状态已保存\n');
    } else {
      console.log('✅ 检测到已登录状态，直接继续\n');
    }
  } catch (err) {
    console.log('\n⚠️  打开Facebook主页时出错，请手动登录...');
    await waitForEnter('   登录完成后按回车继续...\n');
    await context.storageState({ path: CONFIG.STATE_FILE });
  }

  // ===== 打开群组 =====
  console.log(`📂 正在打开群组: ${CONFIG.GROUP_URL}`);
  try {
    await page.goto(CONFIG.GROUP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.PAGE_TIMEOUT
    });
  } catch (err) {
    console.log('⚠️  页面加载超时，尝试继续...');
  }
  await page.waitForTimeout(5000);

  // ===== 滚动与持续解析（应对 Facebook DOM 虚拟化） =====
  // 随着页面往下滚，Facebook 会把最上面的帖子从 DOM 树里删掉（节省内存）
  // 所以我们不能等滚完了再去解析，必须“边滚边抓，存入集合去重”
  console.log(`📥 开始滚动并持续抓取 (共 ${CONFIG.SCROLL_TIMES} 次)...`);

  const allPostsMap = new Map(); // 用于去重，key 取帖子的 text
  let previousHeight = 0;
  let stuckCount = 0;

  // 抽取页面解析逻辑到一个独立的 evaluate 回调里
  const extractCurrentPosts = async () => {
    return await page.evaluate(() => {
      const results = [];
      const storyMessages = document.querySelectorAll('[data-ad-rendering-role="story_message"]');

      // 帮助函数：从容器内提取纯净的 permalink
      const getCleanLink = (node) => {
        const allLinks = node.querySelectorAll('a[href]');
        let groupId = '';
        let postId = '';

        for (const a of allLinks) {
          const h = a.href;

          // 提取 groupId（从任意 /groups/xxx 链接）
          if (!groupId) {
            const gm = h.match(/\/groups\/(\d+)/);
            if (gm) groupId = gm[1];
          }

          // 策略1: 直接的 /posts/{id} 或 /permalink/{id}
          if (!postId) {
            const pm = h.match(/\/(?:posts|permalink)\/(\d+)/);
            if (pm) postId = pm[1];
          }

          // 策略2: 图片链接中的 set=gm.{id} 或 set=pcb.{id}
          if (!postId) {
            const sm = h.match(/[?&]set=(?:gm|pcb)\.(\d+)/);
            if (sm) postId = sm[1];
          }

          if (groupId && postId) break;
        }

        if (groupId && postId) {
          return `https://www.facebook.com/groups/${groupId}/permalink/${postId}/`;
        }

        // 调试：打印前5个，仅在找不到时
        const hrefs = Array.from(allLinks).slice(0, 5).map(a => a.href.substring(0, 100));
        console.log('[DEBUG link] 未匹配，共链接:', allLinks.length, '，前5:', JSON.stringify(hrefs));

        return '';
      };

      storyMessages.forEach(msgEl => {
        const text = msgEl.innerText.trim();
        if (!text || text.length < 10) return;

        let container = msgEl.closest('[role="article"]');
        if (!container) {
          let curr = msgEl.parentElement;
          while (curr && curr !== document.body) {
            if (curr.querySelector('[data-ad-rendering-role="profile_name"]')) {
              container = curr;
              break;
            }
            curr = curr.parentElement;
          }
          if (!container) container = msgEl.parentElement;
        }

        const profileEl = container.querySelector('[data-ad-rendering-role="profile_name"]');
        let author = profileEl ? profileEl.innerText.trim() : '';
        if (!author) {
          const authorEl = container.querySelector('h2 a, h3 a, strong a');
          author = authorEl ? authorEl.innerText.trim() : '未知用户';
        }

        let visibleTime = '';
        const allLinks = container.querySelectorAll('a[href*="/posts/"], a[href*="permalink"], a[href*="story_fbid"]');
        for (const link of allLinks) {
          const inProfile = link.closest('[data-ad-rendering-role="profile_name"]');
          const inMessage = link.closest('[data-ad-rendering-role="story_message"]');
          if (!inProfile && !inMessage) {
            const linkText = link.innerText.trim();
            if (linkText && linkText.length > 0 && linkText.length < 50) {
              visibleTime = linkText;
              break;
            }
          }
        }

        const finalLink = getCleanLink(container);

        results.push({ author, visibleTime, text, link: finalLink });
      });

      // 回退策略（非 story_message 形式的帖子）
      if (results.length === 0) {
        document.querySelectorAll('[role="article"]').forEach(article => {
          const clone = article.cloneNode(true);
          clone.querySelectorAll('button, [role="button"]').forEach(el => el.remove());
          const text = clone.innerText.trim().substring(0, 2000);
          if (!text || text.length < 30) return;

          const authorEl = article.querySelector('h2 a, h3 a, strong a');
          const author = authorEl ? authorEl.innerText.trim() : '未知用户';
          
          const finalLink = getCleanLink(article);

          results.push({ author, visibleTime: '', text, link: finalLink });
        });
      }

      return results;
    });
  };

  // 获取初始可视区域内的帖子
  let currentPosts = await extractCurrentPosts();
  currentPosts.forEach(p => allPostsMap.set(p.text, p));

  // 缓慢向下滚一遍
  for (let i = 0; i < CONFIG.SCROLL_TIMES; i++) {
    await page.mouse.wheel(0, 2000); // 改为 2000 一下，能更好地让中间的帖子渲染
    await page.waitForTimeout(CONFIG.SCROLL_DELAY);

    // 每次滚完都抓一遍当前还在 DOM 里的帖子
    currentPosts = await extractCurrentPosts();
    currentPosts.forEach(p => allPostsMap.set(p.text, p));

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === previousHeight) {
      stuckCount++;
      if (stuckCount >= 5) {
        console.log('\n⚠️  页面已到底或无法继续加载，停止滚动');
        break;
      }
    } else {
      stuckCount = 0;
      previousHeight = newHeight;
    }

    process.stdout.write(`   滚动进度: ${i + 1}/${CONFIG.SCROLL_TIMES} (已提取: ${allPostsMap.size} 篇去重)\r`);
  }
  console.log('\n\n✅ 滚动完成');

  // 将 Map 转换为数组
  const posts = Array.from(allPostsMap.values());
  console.log(`📊 共提取去重后帖子: ${posts.length} 条`);

  // 群组ID，用于生成搜索链接
  const groupIdMatch = CONFIG.GROUP_URL.match(/\/groups\/([0-9a-zA-Z]+)/);
  const groupId = groupIdMatch ? groupIdMatch[1] : '';

  // ===== 过滤 =====
  const leads = [];
  let excludeCount = 0;

  for (const post of posts) {
    // 1. 排除名单
    const isExcluded = CONFIG.EXCLUDE_PROFILES.some(name =>
      post.author.toLowerCase().includes(name.toLowerCase())
    );
    if (isExcluded) {
      excludeCount++;
      continue;
    }

    // 2. 关键词匹配
    // console.log("post.text=", post.text)
    const matchedKeyword = getMatchedKeyword(post.text);
    if (matchedKeyword) {
      post.matchedKeyword = matchedKeyword;

      // 搜索回调链接
      if (groupId) {
        post.searchLink = `https://www.facebook.com/groups/${groupId}/search/?q=${encodeURIComponent(matchedKeyword)}`;
      }

      leads.push(post);
    }
  }

  console.log(`\n=== 筛选结果 ===`);
  console.log(`- 排除名单过滤: ${excludeCount} 条`);
  console.log(`🎯 最终潜在客户线索: ${leads.length} 条`);

  // ===== 输出 =====
  leads.forEach((lead, i) => {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`【客户 ${i + 1}】 ${lead.author}`);
    console.log(`  🔑 匹配关键词: ${lead.matchedKeyword}`);
    if (lead.visibleTime) console.log(`  🕐 时间: ${lead.visibleTime}`);
    if (lead.searchLink) console.log(`  🔗 群内搜索: ${lead.searchLink}`);
    if (lead.link) console.log(`  🔗 原帖链接: ${lead.link}`);
    console.log(`  📝 内容:\n${lead.text.substring(0, 300)}${lead.text.length > 300 ? '...' : ''}`);
  });

  if (leads.length === 0 && posts.length > 0) {
    console.log('\n⚠️  有帖子但无关键词匹配，前5条帖子预览:');
    posts.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.author}] ${p.text.substring(0, 100)}...`);
    });
  }

  saveResults(leads);
  await browser.close();
  console.log('\n🏁 抓取完成！');
})();