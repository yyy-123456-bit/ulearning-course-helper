// 一次性冒烟测试：用 jsdom 模拟优学院课件页，验证面板挂载、视频静音、题库作答
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const code = fs.readFileSync(path.join(__dirname, 'ulearning-course-helper.user.js'), 'utf8');

const html = `<!DOCTYPE html><html><body>
  <div class="course-title">第一章 绪论</div>
  <video id="v" src="https://example.com/a.mp4"></video>

  <div class="question-item">
    <div class="question-title">1. 中国共产党人的初心和使命是（ ）</div>
    <div class="gray">单选题</div>
    <ul>
      <li><label class="ul-radio"><span class="ul-radio__input"><input type="radio" name="q1"></span><span class="ul-radio__label">A. 为世界谋大同</span></label></li>
      <li><label class="ul-radio"><span class="ul-radio__input"><input type="radio" name="q1"></span><span class="ul-radio__label">B. 为中国人民谋幸福，为中华民族谋复兴</span></label></li>
      <li><label class="ul-radio"><span class="ul-radio__input"><input type="radio" name="q1"></span><span class="ul-radio__label">C. 为个人谋发展</span></label></li>
    </ul>
  </div>

  <div class="question-item">
    <div class="question-title">2. 实践是检验真理的唯一标准。</div>
    <div class="gray">判断题</div>
    <ul>
      <li><label class="ul-radio"><span class="ul-radio__input"><input type="radio" name="q2"></span><span class="ul-radio__label"><i class="iconfont icon-zhengque"></i>正确</span></label></li>
      <li><label class="ul-radio"><span class="ul-radio__input"><input type="radio" name="q2"></span><span class="ul-radio__label"><i class="iconfont icon-cuowu1"></i>错误</span></label></li>
    </ul>
  </div>

  <button class="next-page-btn">下一页</button>
</body></html>`;

const dom = new JSDOM(html, {
  url: 'https://ua.ulearning.cn/learnCourse/learnCourse.html?courseId=1',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;

// jsdom 不做布局，这里让可见性判断按真实浏览器行为工作
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 200, height: 30, top: 0, left: 0, right: 200, bottom: 30, x: 0, y: 0 };
};
const realGCS = window.getComputedStyle.bind(window);
window.getComputedStyle = (el) => {
  const s = realGCS(el);
  return new Proxy(s, {
    get(t, k) {
      if (k === 'display') return 'block';
      if (k === 'visibility') return 'visible';
      if (k === 'opacity') return '1';
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    }
  });
};

// GM_* 走 localStorage 回退
const bank = [
  { question: '中国共产党人的初心和使命是（ ）', answer: 'B', type: 'single' },
  { question: '实践是检验真理的唯一标准。', answer: '正确', type: 'judgement' }
];
window.localStorage.setItem('ulch_bank', JSON.stringify(bank));

const virtualConsoleErrors = [];
dom.virtualConsole.on('jsdomError', (e) => virtualConsoleErrors.push(String(e.message)));

window.eval(code);

function report() {
  const doc = window.document;
  const panel = doc.querySelector('.ulch-panel');
  const radios = Array.from(doc.querySelectorAll('input[type="radio"]'));
  const video = doc.querySelector('video');
  console.log(JSON.stringify({
    面板已挂载: !!panel,
    面板标题: panel ? panel.querySelector('.ulch-hd span').textContent : null,
    页面类型: panel ? panel.querySelector('#ulch-kind').textContent : null,
    题库显示: panel ? panel.querySelector('#ulch-bank').textContent : null,
    视频已静音: video.muted,
    单选命中B: radios[1] ? radios[1].checked : null,
    判断命中正确: radios[3] ? radios[3].checked : null,
    本页题目状态: panel ? panel.querySelector('#ulch-q').textContent : null,
    运行时错误: virtualConsoleErrors.slice(0, 3)
  }, null, 2));
}

setTimeout(() => {
  report();
  window.close();
  process.exit(0);
}, 5000);
