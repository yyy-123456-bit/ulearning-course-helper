// ==UserScript==
// @name         优学院课件助手
// @name:en      Ulearning Course Helper
// @namespace    https://github.com/yyy-123456-bit/ulearning-course-helper
// @version      1.0.0
// @description  优学院课件自动播放、播完翻页、本地题库自动作答（默认 1x、不模拟鼠标、默认不自动提交）
// @description:en  Auto-play, auto-turn-page and local question-bank answering for Ulearning course pages.
// @author       yyy
// @match        *://*.ulearning.cn/*
// @match        *://ulearning.cn/*
// @match        *://*.umooc.com.cn/*
// @icon         https://www.ulearning.cn/favicon.ico
// @homepageURL  https://github.com/yyy-123456-bit/ulearning-course-helper
// @supportURL   https://github.com/yyy-123456-bit/ulearning-course-helper/issues
// @updateURL    https://raw.githubusercontent.com/yyy-123456-bit/ulearning-course-helper/main/ulearning-course-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/yyy-123456-bit/ulearning-course-helper/main/ulearning-course-helper.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

/*
 * 风险提示与免责声明
 * 1. 本脚本仅供浏览器自动化技术的学习与研究参考，不构成任何学习建议、成绩承诺或平台使用指导。
 * 2. 相关信息（含题库答案、匹配结果、兼容性说明）仅供参考，不替代专业判断；是否使用、如何使用请自行决定。
 * 3. 使用本脚本可能违反优学院用户协议及所在学校的学术规范，由此产生的任何风险与损失（包括但不限于
 *    学习记录失效、成绩作废、账号封禁、纪律处分）由使用者自行承担。
 * 4. 脚本按"现状"提供，作者不对答案正确性、平台兼容性与使用结果作任何明示或默示保证。
 */

(function () {
  'use strict';

  /* ================= 0. 常量 / 存储 / 工具 ================= */

  const VERSION = '1.0.0';
  const K_CFG = 'ulch_cfg';
  const K_BANK = 'ulch_bank';

  const store = {
    get(key, def) {
      try {
        if (typeof GM_getValue === 'function') {
          const v = GM_getValue(key);
          if (v !== undefined && v !== null) return v;
        }
      } catch (e) { /* 忽略，走 localStorage */ }
      try {
        const s = localStorage.getItem(key);
        if (s != null) return JSON.parse(s);
      } catch (e) { /* 忽略 */ }
      return def;
    },
    set(key, val) {
      try {
        if (typeof GM_setValue === 'function') { GM_setValue(key, val); return; }
      } catch (e) { /* 忽略 */ }
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略 */ }
    }
  };

  const cfg = Object.assign({
    muted: true,
    rate: 1,
    autoResume: true,
    autoNext: true,
    autoFill: true,
    autoSubmit: false,
    autoDismiss: true,
    collapsed: false,
    pos: null
  }, store.get(K_CFG, {}) || {});

  const saveCfg = () => store.set(K_CFG, cfg);

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const txt = (el) => ((el && (el.innerText || el.textContent)) || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => Date.now();

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
  }

  const isTop = (() => { try { return window.top === window.self; } catch (e) { return false; } })();

  function log(msg, lv) {
    const color = { info: '#409EFF', ok: '#67C23A', warn: '#E6A23C', err: '#F56C6C' }[lv] || '#606266';
    try { console.log('%c[优学院助手]%c ' + msg, 'color:#409EFF;font-weight:600', 'color:' + color); } catch (e) { /* 忽略 */ }
  }

  /* ---- 文本归一化：去空白/标点/题号，用于题库比对 ---- */
  const PUNCT_RE = /[\s\u3000，。、；：！？""''（）()《》〈〉【】\[\]{}<>·…—\-_/\\|,.;:!?'"`~@#$%^&*+=]/g;

  function norm(s) {
    return String(s || '')
      .replace(/^[\s]*[（(【\[]?\d+[)）】\].、]/,'')
      .replace(PUNCT_RE, '')
      .toLowerCase();
  }

  function bigrams(s) {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    if (!set.size && s) set.add(s);
    return set;
  }

  /** Dice 系数，0~1，用于长题干近似匹配 */
  function dice(a, b) {
    if (!a || !b) return 0;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0;
    A.forEach((x) => { if (B.has(x)) inter++; });
    return (2 * inter) / (A.size + B.size);
  }

  /* ================= 1. 题库 ================= */

  const Bank = {
    items: [],

    load() {
      let raw = store.get(K_BANK, null);
      // 兼容其它优学院脚本的题库键（Gulu319 用 ul_qbank / qbank）
      if (!raw || !raw.length) {
        try { raw = JSON.parse(localStorage.getItem('ul_qbank') || 'null'); } catch (e) { raw = null; }
      }
      if (!raw || !raw.length) {
        const g = store.get('qbank', null);
        if (Array.isArray(g)) raw = g;
        else if (typeof g === 'string') { try { raw = JSON.parse(g); } catch (e) { /* 忽略 */ } }
      }
      this.items = this.normalizeList(raw);
      this.persist();
      return this.items;
    },

    normalizeList(list) {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const it of list) {
        if (!it || typeof it !== 'object') continue;
        const q = it.question || it.q || it.title || it.name || '';
        let a = it.answer;
        if (a === undefined) a = it.a;
        if (a === undefined) a = it.correctAnswer;
        if (!q || a === undefined || a === null || a === '') continue;
        out.push({ question: String(q), answer: String(a), type: it.type ? String(it.type) : '' });
      }
      return out;
    },

    persist() { store.set(K_BANK, this.items); },

    add(list) {
      const incoming = this.normalizeList(list);
      const seen = new Set(this.items.map((x) => norm(x.question)));
      let added = 0;
      for (const it of incoming) {
        const k = norm(it.question);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        this.items.push(it);
        added++;
      }
      this.persist();
      return added;
    },

    _scan(pool, nq) {
      let contains = null, best = null;
      for (const it of pool) {
        const ni = norm(it.question);
        if (!ni) continue;
        if (ni === nq) return { item: it, score: 1, mode: 'exact' };
        if (!contains && nq.length >= 8 && (ni.includes(nq) || nq.includes(ni))) contains = it;
        const s = dice(nq, ni);
        if (!best || s > best.score) best = { item: it, score: s };
      }
      if (contains) return { item: contains, score: 0.95, mode: 'contains' };
      if (best && best.score >= 0.84) return { item: best.item, score: best.score, mode: 'similar' };
      return null;
    },

    find(question, type) {
      const nq = norm(question);
      if (!nq || nq.length < 4) return null;
      if (type) {
        const sameType = this.items.filter((x) => !x.type || x.type === type || typeAlias(x.type) === type);
        const hit = this._scan(sameType, nq);
        if (hit) return hit;
      }
      return this._scan(this.items, nq);
    }
  };

  function typeAlias(t) {
    const s = String(t).toLowerCase();
    if (/multiple|多选/.test(s)) return 'multiple';
    if (/judge|判断/.test(s)) return 'judgement';
    if (/single|单选/.test(s)) return 'single';
    if (/completion|fill|填空|简答/.test(s)) return 'completion';
    return '';
  }

  /* ================= 2. 题目识别 / 作答 ================= */

  const Q = {
    roots() {
      const sels = ['.question-item', '.question-wrapper', '.question-box', '.exam-question', '[class*="question-item"]'];
      for (const s of sels) {
        const found = $$(s).filter(visible);
        if (found.length) return found;
      }
      // 回退：从题干元素向上找带选项的容器
      const out = [];
      $$('.question-title, .question-stem, [class*="question-title"]').forEach((t) => {
        let p = t;
        for (let i = 0; i < 4 && p && p !== document.body; i++) {
          if (p.querySelector('label, input, textarea, .ul-radio__label, .ul-checkbox__label')) { out.push(p); return; }
          p = p.parentElement;
        }
      });
      return Array.from(new Set(out));
    },

    title(root) {
      const t = $('.question-title, .question-stem, .stem, [class*="question-title"]', root);
      let s = txt(t);
      if (!s) s = txt(root).slice(0, 400);
      return s;
    },

    options(root) {
      const sels = [
        '.ul-radio__label', '.ul-checkbox__label',
        'label.el-radio', 'label.el-checkbox',
        '.option-item', '.answer-item', 'li.option'
      ];
      for (const s of sels) {
        const all = $$(s, root);
        if (!all.length) continue;
        const vis = all.filter((o) => o.getClientRects().length > 0);
        return vis.length ? vis : all; // 拿不到布局信息时退回全集，避免"看不见就当没有"
      }
      const labels = $$('label', root);
      const vis = labels.filter((o) => o.getClientRects().length > 0);
      return vis.length ? vis : labels;
    },

    type(root, opts) {
      const lab = $('.gray, [class*="type"], .question-type, .q-type', root);
      const t = txt(lab);
      if (/多选/.test(t)) return 'multiple';
      if (/判断/.test(t)) return 'judgement';
      if (/单选|单项/.test(t)) return 'single';
      if (/填空|简答|名词|论述|计算|分录|资料|其他|阅读|完形|连线/.test(t)) return 'completion';
      if ($$('input[type="checkbox"]', root).length) return 'multiple';
      if ($$('input[type="radio"]', root).length) return 'single';
      if ($$('textarea', root).length) return 'completion';
      if (opts.some((o) => /icon-zhengque|icon-cuowu/.test(o.innerHTML || ''))) return 'judgement';
      return 'unknown';
    }
  };

  function lettersOf(ans) {
    const m = String(ans).toUpperCase().match(/[A-H]/g);
    return m || [];
  }
  const TRUE_RE = /^(正确|对|是|√|T|TRUE|Y|YES)$/i;
  const FALSE_RE = /^(错误|错|否|×|F|FALSE|N|NO)$/i;

  /** 优学院用 Element UI：选项文字是 span，真正的 label/input 在祖先节点上 */
  function optionHost(opt) {
    return opt.closest('label.ul-radio,label.ul-checkbox,.ul-radio,.ul-checkbox,label.el-radio,label.el-checkbox,.el-radio,.el-checkbox,li')
      || opt;
  }

  function isChecked(opt) {
    const host = optionHost(opt);
    if (/is-checked|checked|selected/.test(host.className || '')) return true;
    const input = host.querySelector ? host.querySelector('input') : null;
    const self = host.matches && host.matches('input') ? host : null;
    return !!((input && input.checked) || (self && self.checked));
  }

  async function clickOption(opt) {
    const host = optionHost(opt);
    if (isChecked(host)) return true;

    const input = host.querySelector ? host.querySelector('input') : null;
    try { (input || host).click(); } catch (e) { /* 忽略 */ }
    await sleep(200);
    if (isChecked(host)) return true;

    try { host.click(); } catch (e) { /* 忽略 */ }
    await sleep(200);
    return isChecked(host);
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function fillCompletion(root, answer) {
    const box = $$('textarea, input[type="text"]', root).filter(visible)[0];
    if (box) {
      setNativeValue(box, String(answer));
      // 优学院部分题型靠 blur 触发布局/校验
      try { box.dispatchEvent(new Event('blur', { bubbles: true })); } catch (e) { /* 忽略 */ }
      return true;
    }

    const frame = $$('iframe', root).filter(visible)[0];
    if (frame) {
      try {
        const doc = frame.contentDocument;
        const ed = doc && (doc.querySelector('.ql-editor, [contenteditable="true"], body[contenteditable="true"]') || doc.body);
        if (ed) {
          ed.focus();
          ed.innerText = String(answer);
          ed.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      } catch (e) { return false; }
    }
    return false;
  }

  async function applyAnswer(root, type, answer) {
    if (type === 'completion') return fillCompletion(root, answer);

    const opts = Q.options(root);
    if (!opts.length) return false;
    const texts = opts.map((o) => txt(o));
    let idx = [];

    if (type === 'judgement') {
      let want = TRUE_RE.test(String(answer).trim()) ? true
        : FALSE_RE.test(String(answer).trim()) ? false
        : null;
      if (want === null) {
        const L = lettersOf(answer);
        if (L.length === 1) want = L[0] === 'A';
      }
      for (let i = 0; i < opts.length; i++) {
        const html = opts[i].innerHTML || '';
        const isTrue = /icon-zhengque/.test(html) || /^(正确|对|√|true)$/i.test(texts[i]);
        const isFalse = /icon-cuowu/.test(html) || /^(错误|错|×|false)$/i.test(texts[i]);
        if (want !== null && ((want && isTrue) || (!want && isFalse))) { idx = [i]; break; }
      }
      if (!idx.length && want !== null) {
        const i = texts.findIndex((t) => (want ? /正确|对|√/ : /错误|错|×/).test(t));
        if (i >= 0) idx = [i];
      }
    } else {
      const L = lettersOf(answer);
      const compact = String(answer).replace(/[\s,，、;；/|]/g, '');
      if (L.length && compact.replace(/[A-Ha-h]/g, '').length === 0) {
        idx = L.map((c) => c.charCodeAt(0) - 65).filter((i) => i >= 0 && i < opts.length);
      } else {
        const parts = String(answer).split(/[\n;,，、|]+/).map((s) => s.trim()).filter(Boolean);
        opts.forEach((o, i) => {
          if (parts.some((p) => p && texts[i] && (texts[i].includes(p) || p.includes(texts[i])))) idx.push(i);
        });
      }
    }

    if (!idx.length) return false;
    for (const i of idx) {
      const ok = await clickOption(opts[i]);
      if (!ok) return false;
      await sleep(260);
    }
    return true;
  }

  /* ================= 3. 视频 ================= */

  const Video = {
    el: null,
    lastPause: 0,
    lastEndedAt: 0,
    lastTry: 0,
    playFails: 0,
    warned: false,

    pick() {
      const all = $$('video').filter((v) => v.readyState > 0 || v.currentSrc || v.src);
      if (!all.length) return null;
      const vis = all.filter(visible);
      const pool = vis.length ? vis : all;
      pool.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      return pool[0];
    },

    bind(v) {
      if (this.el === v) return;
      this.el = v;
      v.addEventListener('playing', () => { this.playFails = 0; this.warned = false; });
      v.addEventListener('pause', () => { if (!v.ended) this.lastPause = now(); });
      v.addEventListener('ended', () => {
        if (now() - this.lastEndedAt < 3000) return;
        this.lastEndedAt = now();
        log('视频播放完毕', 'ok');
        // 视频在子页面时，把"播完"事件交给主页面处理翻页
        if (!isTop) {
          try { parent.postMessage({ __ulch: 1, ended: true }, '*'); } catch (e) { /* 忽略 */ }
          return;
        }
        if (running && cfg.autoNext) Page.next('视频播放完毕');
      });
    },

    tryPlay(v) {
      if (now() - this.lastTry < 4000) return;
      this.lastTry = now();

      // 连续失败说明被浏览器自动播放策略拦了，提示用户手动点一次，不再硬刷
      if (this.playFails >= 3) {
        if (!this.warned) {
          this.warned = true;
          log('浏览器拦截了自动播放，请手动点击一次视频画面', 'warn');
          UI.toast('请手动点一下视频画面，之后会自动接管');
        }
        return;
      }

      const overlay = $('.mejs__overlay-play, .vjs-big-play-button, .prism-big-play-btn');
      try {
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            this.playFails++;
            if (overlay && visible(overlay)) { try { overlay.click(); } catch (e2) { /* 忽略 */ } }
          });
        }
      } catch (e) {
        this.playFails++;
        if (overlay && visible(overlay)) { try { overlay.click(); } catch (e2) { /* 忽略 */ } }
      }
    },

    tick() {
      const v = this.pick();
      if (!v) return null;
      this.bind(v);

      if (cfg.muted && !v.muted) { try { v.muted = true; } catch (e) { /* 忽略 */ } }

      if (cfg.rate && Math.abs((v.playbackRate || 1) - cfg.rate) > 0.01) {
        try { v.playbackRate = cfg.rate; } catch (e) { /* 忽略 */ }
      }

      if (running && cfg.autoResume && v.paused && !v.ended && !document.hidden
        && now() - this.lastPause > 6000) {
        this.tryPlay(v);
      }

      // 兜底：部分 mejs 播放器结束时不一定派发 ended
      if (running && cfg.autoNext && v.duration > 0 && !v.paused
        && v.duration - v.currentTime <= 1.2 && now() - this.lastEndedAt > 4000) {
        this.lastEndedAt = now();
        log('视频已到末尾，准备翻页', 'ok');
        Page.next('视频已到末尾');
      }
      return v;
    }
  };

  /* ================= 4. 翻页 / 弹窗 ================= */

  const Page = {
    lastAt: 0,
    fails: 0,

    key() {
      const v = Video.el;
      const active = txt($('.catalog-active, .active-node, .chapter-name, .current-node'));
      return [location.href, v ? (v.currentSrc || v.src || '') : '', active, Q.roots().length].join('|');
    },

    findNext() {
      const cands = [];
      const push = (el) => { if (el && visible(el) && cands.indexOf(el) < 0) cands.push(el); };

      ['.next-page-btn', '.next-btn', '[class*="next-page"]'].forEach((s) => $$(s).forEach(push));

      if (!cands.length) {
        $$('button, a, div, span').forEach((el) => {
          if (el.children.length) return;
          if (/^(下一页|下一节|下一章|下一步|继续学习)$/.test(txt(el))) push(el.closest('button,a,div') || el);
        });
      }
      return cands.find((el) => !el.disabled && !/disabled/.test(el.className || '')) || null;
    },

    async next(reason, force) {
      if (!force && (!running || !cfg.autoNext)) return false;
      if (now() - this.lastAt < 2000) return false;

      const before = this.key();
      const btn = this.findNext();
      if (!btn) {
        this.toast('没找到「下一页」按钮，可能已是最后一节');
        return false;
      }
      this.lastAt = now();
      try { btn.click(); } catch (e) { /* 忽略 */ }
      log('点击下一页：' + (reason || ''), 'info');
      await sleep(1600);

      if (this.key() === before) {
        this.fails++;
        if (this.fails >= 3) {
          cfg.autoNext = false;
          saveCfg();
          UI.sync();
          this.toast('连续 3 次翻页无变化，已自动暂停翻页');
        }
      } else {
        this.fails = 0;
      }
      return true;
    },

    toast(msg) { UI.toast(msg); }
  };

  const Modal = {
    /** 只处理“离开确认 / 未完成提示”，一律选择留在本页，绝不替你跳过未完成内容 */
    PATTERNS: ['确定要切换页面', '确定离开', '题目未完成', '题目没有完成', '尚未完成', '视频观看时长'],
    KEEP: /^(留在本页|取消|继续学习|继续观看|知道了|关闭)$/,

    check() {
      if (!cfg.autoDismiss) return;
      const boxes = $$('.el-message-box, .ul-message-box, .el-dialog, .ul-dialog, [class*="modal"], [class*="dialog"]')
        .filter(visible);
      for (const box of boxes) {
        const t = txt(box);
        if (!this.PATTERNS.some((p) => t.indexOf(p) >= 0)) continue;
        const btn = $$('button, .el-button, .ul-button, a, span', box)
          .filter((el) => visible(el) && el.children.length === 0)
          .find((el) => this.KEEP.test(txt(el)));
        if (btn) {
          try { btn.click(); } catch (e) { /* 忽略 */ }
          log('已处理弹窗（选择留在本页）：' + txt(box).slice(0, 30), 'warn');
          return;
        }
      }
    }
  };

  /* ================= 5. 页面类型 / 状态 ================= */

  const Answered = new Set();
  const Unmatched = new Set();
  const Attempts = new Map(); // 同一题最多尝试 3 次，避免死循环点击
  let running = true;
  let busy = false;          // 防止 2s 循环与手动按钮并发作答
  let submitted = false;     // 每页只自动提交一次
  let lastSubmitAt = 0;
  let lastHref = location.href;
  let lastAutoFillAt = 0;
  const FrameStatus = { video: null };

  function pageKind() {
    const u = location.href;
    if (/utest|\/exam\b|exam\.html|examPaper/i.test(u)) return 'exam';
    if (/homework|homework\.do|\/quiz\//i.test(u)) return 'work';
    if (/learnCourse|learnCourseNew|learncourse/i.test(u)) return 'course';
    return 'other';
  }

  const KIND_LABEL = { course: '课件学习', work: '作业', exam: '考试', other: '其他页面' };

  /* ================= 6. 自动作答主流程 ================= */

  async function answerPage() {
    if (busy) return { total: 0, filled: 0, unmatched: 0, busy: true };
    const roots = Q.roots();
    if (!roots.length) return { total: 0, filled: 0, unmatched: 0 };

    busy = true;
    let filled = 0, unmatched = 0;
    try {
      for (const root of roots) {
        const title = Q.title(root);
        const key = norm(title).slice(0, 80);
        if (!key || Answered.has(key)) continue;

        const opts = Q.options(root);
        const type = Q.type(root, opts);

        // 题型不明时不敢乱点，直接计入未匹配
        if (!type || type === 'unknown') { unmatched++; Unmatched.add(title); continue; }

        const tries = Attempts.get(key) || 0;
        if (tries >= 3) { unmatched++; Unmatched.add(title); continue; }

        const hit = Bank.find(title, type);
        if (!hit) { unmatched++; Unmatched.add(title); continue; }

        const ok = await applyAnswer(root, type, hit.item.answer);
        Attempts.set(key, tries + 1);
        if (ok) { filled++; Answered.add(key); }
        else { unmatched++; Unmatched.add(title); }
        await sleep(300);
      }
    } finally {
      busy = false;
    }
    return { total: roots.length, filled, unmatched };
  }

  async function trySubmit() {
    if (!cfg.autoSubmit) return;
    if (submitted) return;
    if (pageKind() === 'exam') return;
    if (Unmatched.size > 0) return;
    if (now() - lastSubmitAt < 6000) return;

    // 只认明确的提交按钮，避免误点题目旁的「保存」
    const btn = $$('button, .el-button, .ul-button, .btn-submit')
      .filter(visible)
      .find((el) => /^(提交|提交答案|保存并提交|交卷)$/.test(txt(el)));
    if (!btn) return;

    lastSubmitAt = now();
    submitted = true;
    try { btn.click(); } catch (e) { return; }
    log('已提交本页答案，请到页面核对结果', 'warn');
    UI.toast('已提交，请核对结果');
  }

  /* ================= 7. 面板 UI ================= */

  const CSS = `
.ulch-panel{position:fixed;top:76px;right:16px;width:272px;background:#fff;border-radius:8px;
  box-shadow:0 6px 24px rgba(0,0,0,.14);z-index:2147483000;color:#303133;overflow:hidden;
  font:13px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;user-select:none}
.ulch-hd{display:flex;align-items:center;gap:7px;padding:9px 12px;background:#409EFF;color:#fff;
  font-weight:600;font-size:13px;cursor:move}
.ulch-hd .ulch-dot{width:7px;height:7px;border-radius:50%;background:#67C23A;flex:0 0 auto}
.ulch-hd .ulch-dot.off{background:#C0C4CC}
.ulch-hd .ulch-sp{flex:1}
.ulch-hd button{background:transparent;border:0;color:#fff;cursor:pointer;font-size:14px;
  line-height:1;padding:2px 4px;opacity:.9;font-family:inherit}
.ulch-bd{padding:10px 12px 12px;max-height:calc(100vh - 150px);overflow:auto}
.ulch-row{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;margin-bottom:4px;
  background:#F5F7FA;border-radius:4px;font-size:12px;color:#606266}
.ulch-row b{font-weight:600;color:#303133}
.ulch-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 4px}
.ulch-btn{height:30px;border:1px solid #DCDFE6;background:#fff;color:#606266;border-radius:4px;
  font-size:12px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.ulch-btn:hover{border-color:#409EFF;color:#409EFF}
.ulch-btn.pri{grid-column:span 2;background:#409EFF;border-color:#409EFF;color:#fff;font-weight:600}
.ulch-btn.pri:hover{background:#66b1ff;border-color:#66b1ff;color:#fff}
.ulch-btn.pri.pause{background:#E6A23C;border-color:#E6A23C}
.ulch-btn.pri.pause:hover{background:#ebb563;border-color:#ebb563}
.ulch-set{border-top:1px solid #EBEEF5;margin-top:8px;padding-top:8px;display:flex;flex-direction:column;gap:7px}
.ulch-chk{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#606266;cursor:pointer}
.ulch-chk span{display:flex;align-items:center;gap:6px}
.ulch-chk input{accent-color:#409EFF;margin:0}
.ulch-sel{font-size:12px;color:#606266;border:1px solid #DCDFE6;border-radius:4px;padding:2px 4px;
  font-family:inherit;background:#fff;outline:none}
.ulch-ft{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#909399;
  margin-top:9px;border-top:1px solid #EBEEF5;padding-top:7px}
.ulch-tip{display:none;font-size:11px;line-height:1.5;color:#E6A23C;background:#fdf6ec;
  border-radius:4px;padding:6px 8px;margin-top:7px}
.ulch-tip.show{display:block}
.ulch-mini .ulch-bd{display:none}
.ulch-fs{opacity:.28}
.ulch-fs:hover{opacity:1}
.ulch-toast{position:fixed;left:50%;top:24px;transform:translateX(-50%);background:rgba(48,49,51,.92);
  color:#fff;font-size:12px;padding:8px 14px;border-radius:4px;z-index:2147483001;
  font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;pointer-events:none;
  transition:opacity .25s;opacity:0}
.ulch-toast.show{opacity:1}
`;

  const UI = {
    panel: null,
    toastEl: null,
    toastTimer: 0,

    mount() {
      if (!isTop || this.panel) return;
      addStyle(CSS);

      const p = document.createElement('div');
      p.className = 'ulch-panel' + (cfg.collapsed ? ' ulch-mini' : '');
      p.innerHTML = `
        <div class="ulch-hd" id="ulch-drag">
          <i class="ulch-dot" id="ulch-dot"></i>
          <span>优学院助手</span>
          <span class="ulch-sp"></span>
          <button id="ulch-min" title="收起/展开">${cfg.collapsed ? '▢' : '—'}</button>
        </div>
        <div class="ulch-bd">
          <div class="ulch-row"><span>页面</span><b id="ulch-kind">-</b></div>
          <div class="ulch-row"><span>视频</span><b id="ulch-video">-</b></div>
          <div class="ulch-row"><span>本页题目</span><b id="ulch-q">-</b></div>
          <div class="ulch-row"><span>题库</span><b id="ulch-bank">0 条</b></div>

          <div class="ulch-btns">
            <button class="ulch-btn pri" id="ulch-run">⏸ 暂停</button>
            <button class="ulch-btn" id="ulch-next">⏭ 立即翻页</button>
            <button class="ulch-btn" id="ulch-fill">📝 填充本页</button>
            <button class="ulch-btn" id="ulch-import">📥 导入题库</button>
            <button class="ulch-btn" id="ulch-export">📤 导出题库</button>
            <button class="ulch-btn" id="ulch-diag">🔍 诊断</button>
          </div>

          <div class="ulch-set">
            <label class="ulch-chk"><span>静音播放</span><input type="checkbox" id="ulch-muted"></label>
            <label class="ulch-chk"><span>暂停后自动继续</span><input type="checkbox" id="ulch-resume"></label>
            <label class="ulch-chk"><span>播完自动翻页</span><input type="checkbox" id="ulch-next-auto"></label>
            <label class="ulch-chk"><span>自动填本页答案</span><input type="checkbox" id="ulch-fill-auto"></label>
            <label class="ulch-chk"><span>自动提交（有风险）</span><input type="checkbox" id="ulch-submit"></label>
            <label class="ulch-chk"><span>处理离开确认弹窗</span><input type="checkbox" id="ulch-dismiss"></label>
            <label class="ulch-chk"><span>播放倍速</span>
              <select class="ulch-sel" id="ulch-rate">
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
            </label>
          </div>

          <div class="ulch-tip" id="ulch-tip"></div>
          <div class="ulch-ft"><span title="仅供学习研究参考，不替代专业判断，使用风险由使用者自行承担">v${VERSION} · 仅供学习</span><span id="ulch-state">运行中</span></div>
          <input type="file" id="ulch-file" accept=".json,application/json" style="display:none">
        </div>`;
      document.body.appendChild(p);
      this.panel = p;

      const q = (id) => p.querySelector('#' + id);

      q('ulch-run').addEventListener('click', () => {
        running = !running;
        this.sync();
        log(running ? '已开始' : '已暂停', running ? 'ok' : 'warn');
      });

      q('ulch-next').addEventListener('click', () => Page.next('手动', true));

      q('ulch-fill').addEventListener('click', async () => {
        if (pageKind() === 'exam' && !confirm('当前是考试页面，确认要自动填充答案吗？')) return;
        const r = await answerPage();
        this.toast(`本页 ${r.total} 题：填了 ${r.filled}，未匹配 ${r.unmatched}`);
        this.status();
      });

      q('ulch-import').addEventListener('click', () => q('ulch-file').click());
      q('ulch-file').addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => {
          try {
            const data = JSON.parse(String(fr.result));
            const n = Bank.add(Array.isArray(data) ? data : (data.items || []));
            this.status();
            this.toast('导入 ' + n + ' 条，题库共 ' + Bank.items.length + ' 条');
          } catch (err) {
            this.toast('题库解析失败，请检查 JSON 格式');
          }
          e.target.value = '';
        };
        fr.readAsText(file, 'utf-8');
      });

      q('ulch-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(Bank.items, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ulearning-bank-' + Date.now() + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      });

      q('ulch-diag').addEventListener('click', () => this.diagnose());

      const bind = (id, key, isNum) => {
        const el = q(id);
        el.addEventListener('change', () => {
          cfg[key] = isNum ? Number(el.value) : el.checked;
          saveCfg();
          if (key === 'rate' && Video.el) { try { Video.el.playbackRate = cfg.rate; } catch (e) { /* 忽略 */ } }
        });
      };
      bind('ulch-muted', 'muted');
      bind('ulch-resume', 'autoResume');
      bind('ulch-next-auto', 'autoNext');
      bind('ulch-fill-auto', 'autoFill');
      bind('ulch-submit', 'autoSubmit');
      bind('ulch-dismiss', 'autoDismiss');
      bind('ulch-rate', 'rate', true);

      q('ulch-min').addEventListener('click', () => {
        cfg.collapsed = !cfg.collapsed;
        saveCfg();
        p.classList.toggle('ulch-mini', cfg.collapsed);
        q('ulch-min').textContent = cfg.collapsed ? '▢' : '—';
      });

      this.drag(p, q('ulch-drag'));
      this.restorePos(p);
      this.sync();
      this.status();

      document.addEventListener('fullscreenchange', () => {
        p.classList.toggle('ulch-fs', !!document.fullscreenElement);
      });
    },

    drag(panel, handle) {
      let sx = 0, sy = 0, ox = 0, oy = 0, moving = false;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        moving = true;
        const r = panel.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!moving) return;
        const w = panel.offsetWidth, h = panel.offsetHeight;
        let left = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - w);
        let top = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - Math.min(h, 80));
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => {
        if (!moving) return;
        moving = false;
        const r = panel.getBoundingClientRect();
        cfg.pos = { left: r.left, top: r.top };
        saveCfg();
      });
    },

    restorePos(panel) {
      if (cfg.pos && typeof cfg.pos.left === 'number') {
        panel.style.left = cfg.pos.left + 'px';
        panel.style.top = cfg.pos.top + 'px';
        panel.style.right = 'auto';
      }
    },

    sync() {
      if (!this.panel) return;
      const p = this.panel;
      const set = (id, val) => { const el = p.querySelector('#' + id); if (el) el.checked = !!val; };
      set('ulch-muted', cfg.muted);
      set('ulch-resume', cfg.autoResume);
      set('ulch-next-auto', cfg.autoNext);
      set('ulch-fill-auto', cfg.autoFill);
      set('ulch-submit', cfg.autoSubmit);
      set('ulch-dismiss', cfg.autoDismiss);
      const rate = p.querySelector('#ulch-rate');
      if (rate) rate.value = String(cfg.rate);

      const run = p.querySelector('#ulch-run');
      if (run) {
        run.textContent = running ? '⏸ 暂停' : '▶ 开始';
        run.classList.toggle('pause', !running);
      }
      const dot = p.querySelector('#ulch-dot');
      if (dot) dot.classList.toggle('off', !running);
      const st = p.querySelector('#ulch-state');
      if (st) st.textContent = running ? '运行中' : '已暂停';
    },

    status() {
      if (!this.panel) return;
      const p = this.panel;
      const kind = pageKind();
      const setText = (id, v) => { const el = p.querySelector('#' + id); if (el) el.textContent = v; };

      setText('ulch-kind', KIND_LABEL[kind] || '-');

      const v = Video.el || Video.pick();
      if (v && v.duration > 0) {
        setText('ulch-video', fmt(v.currentTime) + ' / ' + fmt(v.duration) + (v.paused ? '（暂停）' : ''));
      } else if (FrameStatus.video && FrameStatus.video.duration > 0) {
        const f = FrameStatus.video;
        setText('ulch-video', fmt(f.current) + ' / ' + fmt(f.duration) + '（子页面）');
      } else {
        setText('ulch-video', '未检测到');
      }

      const roots = Q.roots().length;
      if (roots) {
        setText('ulch-q', roots + ' 题 · 未匹配 ' + Unmatched.size);
      } else {
        setText('ulch-q', '—');
      }

      setText('ulch-bank', Bank.items.length + ' 条');

      const tip = p.querySelector('#ulch-tip');
      if (tip) {
        if (kind === 'exam') {
          tip.className = 'ulch-tip show';
          tip.textContent = '考试页面：不会自动作答、不会自动提交，避免误操作。';
        } else if (Bank.items.length === 0) {
          tip.className = 'ulch-tip show';
          tip.textContent = '题库为空：只能自动播放/翻页。导入 JSON 题库后才会自动填答案。';
        } else {
          tip.className = 'ulch-tip';
        }
      }
    },

    toast(msg) {
      if (!isTop) return;
      if (!this.toastEl) {
        addStyle(CSS);
        const t = document.createElement('div');
        t.className = 'ulch-toast';
        document.body.appendChild(t);
        this.toastEl = t;
      }
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
    },

    diagnose() {
      const nextBtn = Page.findNext();
      const report = {
        版本: VERSION,
        地址: location.href,
        是否顶层: isTop,
        页面类型: pageKind(),
        视频: $$('video').map((v) => ({ 时长: Math.round(v.duration || 0), 暂停: v.paused, 可见: visible(v) })),
        题目容器: ['.question-item', '.question-wrapper', '.question-box', '.question-title']
          .map((s) => ({ 选择器: s, 数量: $$(s).length })),
        选项容器: ['.ul-radio__label', '.ul-checkbox__label', 'label.el-radio', '.option-item']
          .map((s) => ({ 选择器: s, 数量: $$(s).length })),
        下一页按钮: nextBtn ? { 找到: true, 文案: txt(nextBtn), 类名: String(nextBtn.className || '') } : { 找到: false },
        题库条数: Bank.items.length,
        未匹配题数: Unmatched.size,
        首题文本: Q.roots()[0] ? Q.title(Q.roots()[0]).slice(0, 120) : ''
      };
      const text = JSON.stringify(report, null, 2);
      try { console.log('[优学院助手] 诊断报告\n' + text); } catch (e) { /* 忽略 */ }
      try {
        navigator.clipboard.writeText(text);
        this.toast('诊断信息已复制到剪贴板');
      } catch (e) {
        this.toast('诊断信息已输出到控制台（F12）');
      }
    }
  };

  function fmt(s) {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function addStyle(css) {
    try {
      if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; }
    } catch (e) { /* 忽略 */ }
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ================= 8. 主循环 ================= */

  async function loop() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      Answered.clear();
      Unmatched.clear();
      Attempts.clear();
      submitted = false;
      Page.fails = 0;
      Video.lastEndedAt = 0;
    }

    Video.tick();
    Modal.check();

    const kind = pageKind();
    if (running && cfg.autoFill && kind !== 'exam' && now() - lastAutoFillAt > 4000) {
      lastAutoFillAt = now();
      if (Q.roots().length) {
        const r = await answerPage();
        if (r.filled) log('本页已填 ' + r.filled + ' 题', 'ok');
        if (r.total && r.unmatched === 0) await trySubmit();
      }
    }

    if (!isTop) {
      const v = Video.el;
      if (v) {
        try {
          parent.postMessage({
            __ulch: 1,
            video: { current: v.currentTime || 0, duration: v.duration || 0, paused: !!v.paused }
          }, '*');
        } catch (e) { /* 忽略 */ }
      }
    }

    UI.status();
  }

  /* ================= 9. 启动 ================= */

  function shouldRun() {
    return /learnCourse|learnCourseNew|homework|\/quiz\/|utest|exam|#\/course/i.test(location.href);
  }

  function boot() {
    Bank.load();

    if (isTop) {
      window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.__ulch !== 1) return;
        if (d.video) FrameStatus.video = d.video;
        if (d.ended && running && cfg.autoNext) Page.next('子页面视频播放结束');
      });
    }

    if (isTop && shouldRun()) UI.mount();

    setInterval(loop, 2000);
    log('v' + VERSION + ' 已加载 · 题库 ' + Bank.items.length + ' 条 · ' + (isTop ? '主页面' : '子页面'), 'ok');

    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('显示/隐藏优学院助手', () => {
          if (!UI.panel) { UI.mount(); return; }
          UI.panel.style.display = UI.panel.style.display === 'none' ? '' : 'none';
        });
        GM_registerMenuCommand('输出诊断信息', () => {
          if (UI.panel) UI.diagnose();
          else console.log('[优学院助手] 当前页面未启用（' + location.href + '）');
        });
      }
    } catch (e) { /* 忽略 */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
