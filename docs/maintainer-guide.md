# 优学院课件助手 · GitHub 发布操作攻略

> 面向维护者视角的发布清单。按顺序执行即可从"本地三个文件"变成"可被陌生人安装、可被 issue 反馈、可长期维护"的开源仓库。
> 命令以 Git Bash（Windows）为准，macOS/Linux 基本通用。

---

## 0. 先补齐这些信息（否则下面的命令要改）

> **已确认（2026-11-18）**：GitHub 用户名 `yyy-123456-bit`，仓库名 `ulearning-course-helper`，所有署名/落款统一为 `yyy`。
> 下列第 1~3 项已据此填好，第 4~7 项仍待决定。

| # | 需要你确认 | 影响什么 | 默认建议 |
|---|---|---|---|
| 1 | GitHub 用户名 / 组织名 + 仓库名 | `@namespace`、`@updateURL`、clone 地址、徽章 | 仓库名 `ulearning-course-helper` |
| 2 | 署名用什么 | `@author`、LICENSE 版权人、README 作者栏 | **建议用 GitHub ID 或化名，不要用真实姓名+学校**（见 §7 风险） |
| 3 | 许可证版权人写谁 | `LICENSE` 里的 `Copyright (c) 2026 XXX` | 同上 |
| 4 | 是否公开示例题库 | 仓库里放不放 `examples/bank.sample.json` | 只放 3~5 条通用示例题，**不要放学校真题** |
| 5 | 分发渠道 | 只 GitHub，还是同步 Greasyfork / 脚本猫 | 先 GitHub，观察后再决定（见 §7） |
| 6 | 是否接受 PR / 是否双语 README | `CONTRIBUTING.md`、README 结构 | 接受 issue，PR 谨慎；README 中文为主 |
| 7 | `test-smoke.js` 是否入库 | 需要 `package.json` + CI | 入库，作为回归测试的门面 |

**其中 1、2、3 是硬阻塞**：没有用户名就没法写 `@updateURL`，没有署名就没法生成 `LICENSE`。

---

## 1. 发布前检查（基于当前文件的真实审计）

### 1.1 现状体检

| 项目 | 状态 | 说明 |
|---|---|---|
| 脚本可运行 | ✅ | 1058 行 / 39.8 KB，`node --check` 通过，jsdom 冒烟测试通过 |
| 无远程代码加载 | ✅ | 无 `@require`、无 `@connect`、无 `eval`、无 `new Function` |
| 无凭据/密钥 | ✅ | 全文扫描 token / password / secret / api_key，零命中 |
| `innerHTML` 使用 | ⚠️ | 仅第 691 行，拼接的是**静态模板字符串**（只插入版本号和布尔值），无可注入的用户输入。安全，但建议加注释说明，免得 reviewer 误判 |
| `postMessage('*')` | ⚠️ | 仅传视频进度/播完事件，不含敏感数据；可改为校验 `e.origin`（见 §5.3） |
| 脚本元数据 | ❌ | 缺 `@homepageURL`、`@supportURL`、`@updateURL`、`@downloadURL`、`@icon` |
| `@namespace` | ❌ | 当前是 `https://local.ulearning-course-helper`，占位地址，必须换成你的仓库地址 |
| `@author` | ❌ | 当前是 `WorkBuddy`，需改成你自己 |
| LICENSE 文件 | ❌ | 头部有 `@license MIT`，但仓库没有 `LICENSE` 文件（法律上不完整） |
| README | ❌ | 只有一份 `优学院脚本-使用说明.md`，不是 GitHub 首页 |
| .gitignore | ❌ | 缺，`node_modules`、题库导出、系统文件会混进提交 |
| Git 仓库 | ❌ | 当前目录不是 git 仓库，需要 `git init` |
| 版本号 | ⚠️ | 脚本 `1.0.0`，无 tag、无 CHANGELOG |

### 1.2 发布前必须改的脚本头（改成这样再提交）

```javascript
// ==UserScript==
// @name         优学院课件助手
// @name:en      Ulearning Course Helper
// @namespace    https://github.com/yyy-123456-bit/ulearning-course-helper
// @version      1.0.0
// @description  优学院课件自动播放、播完翻页、本地题库自动作答（默认 1x、不模拟鼠标、默认不自动提交）
// @description:en Auto-play and auto-answer helper for Ulearning course pages.
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
```

要点：

- `@namespace` 必须是**你控制的 URL**，篡改猴用它做脚本唯一标识；占位地址会导致以后改名时用户端出现"重复脚本"。
- `@updateURL` / `@downloadURL` **必须指向仓库里那个真实文件名**，且分支名要对（`main` 还是 `master`）。写错 = 用户永远收不到更新。
- 想用 Release 附件而不是 main 分支，就改成
  `https://github.com/yyy-123456-bit/ulearning-course-helper/releases/latest/download/ulearning-course-helper.user.js`
  —— 好处是更新经过你发版控制，坏处是每次都要发 Release。
- `@name` 建议去掉"（本地题库 · 轻量版）"这类括号后缀，脚本管理器列表里更清爽，版本差异写进 CHANGELOG。

### 1.3 发布前自测清单

- [ ] 在**真实的**优学院课件页跑通：播放 → 播完 → 翻页
- [ ] 作业页填答案后手动核对 3 题以上
- [ ] 考试页确认不会自动作答（面板应显示橙色警告）
- [ ] 关掉脚本对比：面板消失、无残留 DOM（`.ulch-*`）
- [ ] 刷新页面、切换章节、切标签页后不重复注入面板
- [ ] 题库导入非法 JSON 时不崩溃（只提示解析失败）
- [ ] 在 Edge + 篡改猴、Chrome + 脚本猫各装一次，确认 `GM_*` 权限正常

---

## 2. 仓库结构与文件整理

### 2.1 目标结构（单文件用户脚本，保持扁平）

```
ulearning-course-helper/
├─ ulearning-course-helper.user.js   ← 必须在根目录，raw 安装链接要稳定
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
├─ .gitignore
├─ .gitattributes
├─ package.json                      ← 仅开发依赖（jsdom），不是 npm 发布包
├─ test-smoke.js
├─ docs/
│  ├─ usage.md                       ← 由现有「使用说明」迁入
│  └─ troubleshooting.md             ← 诊断信息怎么发、常见报错
├─ examples/
│  └─ bank.sample.json               ← 3~5 条通用示例题
└─ .github/
   ├─ ISSUE_TEMPLATE/bug_report.yml
   ├─ ISSUE_TEMPLATE/config.yml
   ├─ pull_request_template.md
   └─ workflows/ci.yml
```

**关键决策：用户脚本不要放进 `src/`。** 因为安装链接通常是
`https://raw.githubusercontent.com/yyy-123456-bit/ulearning-course-helper/main/ulearning-course-helper.user.js`，
路径一旦变，所有已安装用户的 `@updateURL` 全部失效。根目录是契约。

### 2.2 初始化命令

```bash
cd "D:/AIData/workbuddy/2026-11-18-10-22-39"

# 1) 建目录骨架
mkdir -p docs examples .github/ISSUE_TEMPLATE .github/workflows

# 2) 把现有说明迁到 docs/
git mv 优学院脚本-使用说明.md docs/usage.md   # 首次 init 前用普通 mv

# 3) 改名（去掉中文括号后缀，和 @name 对齐）
#    ulearning-course-helper.user.js 已经是对的，不用改

# 4) 初始化
git init -b main
```

### 2.3 `.gitignore`

```gitignore
node_modules/
package-lock.json.bak
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/

# 题库：极可能含学校内部试题，别进版本库
bank/
*.bank.json
exports/
ulearning-bank-*.json

# 本地诊断产物
diagnose-*.json
```

> 题库为什么必须忽略：一是可能包含学校未公开的试题（版权/学术风险），二是体积会失控，三是被搜索引擎抓取后你的仓库会变成"答案站"，平台侧更容易盯上。

### 2.4 `.gitattributes`（Windows 上很重要）

```gitattributes
* text=auto eol=lf
*.user.js text eol=lf
*.ps1 text eol=crlf
```

CRLF 混进 `.user.js` 不会报错，但会让 diff 满屏噪音，Review 时很痛苦。

---

## 3. 项目说明文档

### 3.1 README.md 的结构（照这个顺序写）

```markdown
# 优学院课件助手

> 一句话：优学院课件页自动播放、播完翻页、按本地题库填练习题。默认 1x、不模拟鼠标、默认不自动提交。

[![version](https://img.shields.io/badge/version-1.0.0-blue)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20ScriptCat-orange)](#)

## 功能
- ✅ 自动播放 / 静音 / 暂停后自动继续
- ✅ 播完自动翻页（连续 3 次无变化自动停）
- ✅ 本地题库自动作答（单选/多选/判断/填空）
- ❌ 不加速（默认 1x，最高可选 2x）
- ❌ 不模拟鼠标键盘、不伪造学习时长
- ❌ 考试页不自动作答、默认不自动提交

## 安装
1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [ScriptCat](https://scriptcat.org/)
2. 点这里安装 → `https://raw.githubusercontent.com/yyy-123456-bit/ulearning-course-helper/main/ulearning-course-helper.user.js`
3. 打开优学院课程 → 课件页 → 右上角出现面板

## 使用
（表格：面板各项 + 推荐配置）

## 题库
（格式说明 + 示例 + 导入导出）

## 兼容性
| 页面 | 状态 |
|---|---|
| learnCourse.html / learnCourseNew | ✅ |
| homework.do 作业 | ✅ 作答，不自动提交 |
| utest 考试 | ⚠️ 仅手动 |

## 已知限制
（PPT 分页、定制域名、iframe 跨域……原样搬 §适配矩阵）

## 排查
点面板「🔍 诊断」，把 JSON 贴到 issue。

## 免责声明
本项目仅供学习浏览器自动化技术。使用本脚本可能违反优学院用户协议及所在学校的学术规范，
由此产生的一切后果（包括但不限于成绩作废、纪律处分、账号封禁）由使用者自行承担。
作者不对题库答案的正确性作任何保证。

## License
MIT
```

**写法要点**

- 前三行决定别人装不装：一句话定位 + 安装链接 + 一张截图（`docs/screenshot.png`，放面板真实截图）。
- 明确写"不做什么"比写"能做什么"更能减少 issue —— 上面那三条 ❌ 就是过滤器。
- 诊断入口要写进 README，否则 80% 的 issue 只会说"没反应"。

### 3.2 CHANGELOG.md（Keep a Changelog 格式）

```markdown
# Changelog

## [1.0.0] - 2026-11-18
### Added
- 视频自动播放、静音、暂停恢复
- 播完自动翻页，三次无变化自动停止
- 本地题库自动作答（单选/多选/判断/填空）
- 面板：拖拽、收起、题库导入导出、诊断
### Security
- 不加载远程代码，不发起任何网络请求
```

### 3.3 `docs/troubleshooting.md`

至少覆盖：面板不出现 / 视频不自动播 / 题目未匹配 / 翻页卡住 / 题库导入失败，每条给"看哪里 → 怎么修"。

---

## 4. 许可证与依赖声明

### 4.1 生成 LICENSE

```bash
# 用 GitHub CLI，会自动填年份和版权人
gh api -X GET /licenses/mit --jq .body \
  | sed "s/\[year\]/2026/; s/\[fullname\]/yyy/" > LICENSE
```

没有 `gh` 就手写，MIT 全文 21 行，第一行必须是：

```
MIT License

Copyright (c) 2026 yyy
```

要点：

- 脚本头 `@license MIT` 和仓库 `LICENSE` 必须一致，否则 Greasyfork / 脚本猫审核会打回。
- MIT 是**免责**不是**授权**：它不能让你免除平台 ToS 或学校纪律的约束，README 的免责声明要单独写。
- 如果以后想禁止商用/二次分发，那要换 Apache-2.0 + NOTICE 或自定义协议，别在 MIT 上打补丁。

### 4.2 package.json（只做开发工具链，不发 npm）

```json
{
  "name": "ulearning-course-helper",
  "version": "1.0.0",
  "private": true,
  "description": "Userscript for Ulearning course pages",
  "license": "MIT",
  "scripts": {
    "check": "node --check ulearning-course-helper.user.js",
    "test": "node --check ulearning-course-helper.user.js && node test-smoke.js"
  },
  "devDependencies": {
    "jsdom": "^24.0.0"
  }
}
```

要点：

- `"private": true` 防止误发到 npm。
- **运行时零依赖**是用户脚本的核心优势，必须保持：不要为了图省事引入 jQuery / lodash，篡改猴用户装不上会直接报错。
- `devDependencies` 只放测试用的 jsdom，版本用 `^` 锁大版本。
- 提交 `package-lock.json`（保证 CI 可复现），但 `node_modules/` 必须进 `.gitignore`。

---

## 5. 敏感信息与安全审查

### 5.1 提交前扫一遍

```bash
# 凭据类
grep -nEi "token|password|passwd|secret|api[_-]?key|access[_-]?key|BEGIN .*PRIVATE KEY" \
  ulearning-course-helper.user.js test-smoke.js docs/*.md

# 远程代码加载（供应链风险）
grep -nE "@require|@connect|eval\(|new Function|document\.write" ulearning-course-helper.user.js

# 外发请求
grep -nE "fetch\(|XMLHttpRequest|sendBeacon|\.src\s*=\s*[\"']http" ulearning-course-helper.user.js

# 个人信息
grep -nEi "学号|身份证|手机号|@[a-z0-9.-]+\.(com|cn|edu)" -r . --include="*.md" --include="*.js"
```

当前脚本的预期结果：**全部零命中**（唯一命中是 `postMessage`，见 5.3）。

### 5.2 权限最小化

| 检查 | 当前 | 结论 |
|---|---|---|
| `@grant` 是否只申请实际用到的 | 4 个，全部用到 | ✅ |
| 是否滥用 `unsafeWindow` | 未申请 | ✅ |
| 是否有 `@connect *` | 无 | ✅ 不联网，这是最大的信任卖点，别为了"在线题库"破坏它 |
| `@run-at` 是否合理 | `document-idle` | ✅ |

### 5.3 两处可加固（不阻塞发布，但建议做）

1. **`postMessage` 加 origin 校验**（第 406、1005 行）：
   目前 `parent.postMessage(..., '*')` 只传进度数据，风险低；但把 `'*'` 改成 `location.origin`，并在接收端校验 `e.origin === location.origin`，能避免被第三方 iframe 伪造进度。
2. **`innerHTML` 加注释**（第 691 行）：
   在模板字符串上方写一行 `// 静态模板，仅插入版本号/布尔值，不接受任何外部输入`，省得 reviewer 提 XSS。

### 5.4 仓库侧开关

- Settings → Code security → 开启 **Secret scanning** 与 **Push protection**（对公开仓库免费）。
- 首次 `git push` 前确认没有 `.env`、没有题库导出文件、没有浏览器 profile 备份。
- **绝对不要**把优学院账号密码写进 README 示例或测试用例。

---

## 6. 提交与版本发布

### 6.1 首次提交（Conventional Commits）

```bash
git add .
git commit -m "feat: 优学院课件助手 v1.0.0

- 视频自动播放/静音/暂停恢复
- 播完自动翻页（三次无变化自动停止）
- 本地题库自动作答（单选/多选/判断/填空）
- 面板：拖拽/收起/题库导入导出/诊断

不加速、不模拟鼠标、默认不自动提交。"
```

提交粒度建议：如果想让历史好看，拆成 4 个 commit（chore: 脚手架 / feat: 核心逻辑 / test: 冒烟测试 / docs: 文档），但**首次发布拆不拆无所谓**，别为了好看把能跑的代码拆坏。

### 6.2 建远程仓库并推送

```bash
# 方式 A：gh CLI（推荐，自动建仓库 + 设 remote）
gh repo create ulearning-course-helper --public --source=. --remote=origin --push

# 方式 B：先在网页建空仓库，再
git remote add origin https://github.com/yyy-123456-bit/ulearning-course-helper.git
git branch -M main
git push -u origin main
```

### 6.3 打 tag + 发 Release（决定用户能否自动更新）

```bash
git tag -a v1.0.0 -m "v1.0.0 首个公开版本"
git push origin v1.0.0

gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file CHANGELOG.md \
  ulearning-course-helper.user.js
```

要点：

- **tag 名带 `v`，脚本 `@version` 不带 `v`**（`v1.0.0` ↔ `1.0.0`），这是篡改猴比较版本号的前提。
- Release 附件名必须和 `@downloadURL` 里的文件名**完全一致**。
- 想给用户可验证性，加一个校验和：
  ```bash
  sha256sum ulearning-course-helper.user.js > ulearning-course-helper.user.js.sha256
  gh release upload v1.0.0 ulearning-course-helper.user.js.sha256
  ```
- 发布后立刻**用无痕窗口**点一次 README 的安装链接，确认篡改猴弹出的是 `1.0.0` 而不是旧缓存。

### 6.4 版本号规则

| 改动类型 | 版本 |
|---|---|
| 选择器修复、平台改版适配 | PATCH `1.0.1` |
| 新增功能（如 PPT 翻页） | MINOR `1.1.0` |
| 破坏性变更（改题库键名、改存储结构） | MAJOR `2.0.0` |

平台改版导致脚本失效时，**当天发 PATCH**。用户对"失效三天没修"的容忍度极低。

---

## 7. 发布后维护

### 7.1 Issue 模板（把"没反应"变成可定位的信息）

`.github/ISSUE_TEMPLATE/bug_report.yml` 至少要求填：

- 优学院页面地址（可打码，但要保留 `learnCourse` / `homework` / `utest` 路径特征）
- 脚本版本
- 浏览器 + 脚本管理器 + 版本
- **诊断 JSON**（面板 🔍 诊断的输出，这是最关键的一项）
- 期望行为 / 实际行为

`config.yml` 里加 `blank_issues_enabled: false`，强制走模板。

### 7.2 CI（30 行足够）

`.github/workflows/ci.yml`：push / PR 时跑

1. `node --check ulearning-course-helper.user.js`（语法）
2. 元数据校验（必备键、版本号正则、`@match` 非空、`@updateURL` 与仓库路径一致）
3. `npm ci && node test-smoke.js`（jsdom 回归）

这样"改选择器改崩了"能在合并前挡住，而不是等用户报错。

### 7.3 平台改版的应对机制

- 把选择器**集中**在 `Q` / `Page` / `Video` 三个对象里（当前已满足），改版时只改一处。
- 每次平台改版修复后，在 CHANGELOG 写清"适配 2026-11 新版 learnCourseNew 结构"，方便用户判断要不要升级。
- 保留「🔍 诊断」作为长期能力，它是你唯一的远程调试手段。

### 7.4 分发渠道的现实问题（必须提前知道）

| 渠道 | 现实情况 |
|---|---|
| GitHub | 托管源码基本无审核障碍，但**不要**把可执行文件伪装成正常软件分发 |
| Greasyfork | 有明确规则：违反目标站点 ToS 的脚本可能被举报下架；上架时如实填写功能，别写"学习辅助"掩盖自动答题 |
| 脚本猫 | 审核相对宽松，但同样接受举报 |
| 学校/平台 | 优学院可发 DMCA 类投诉，也可能直接封账号 |

结论：**GitHub 做源码托管 + 自建 raw 安装链接是最稳的**；第三方脚本商店当作可选项，且要有"随时被下架"的心理准备。不要为了上架去隐藏脚本真实功能——那会让下架变成永久封禁。

### 7.5 长期维护的现实预期

- 优学院至少三套前端并存（`learnCourse` / `learnCourseNew` / `umooc`），任何一套改版都会让你的选择器失效。
- 2~3 个月不维护，issue 区就会堆满"没反应"。要么明确写"本项目为一次性发布，不保证长期维护"，要么做好接 issue 的准备。
- 不要在 README 承诺"永久免费更新"，这是给自己挖坑。

### 7.6 必须出现在仓库里的免责声明（可直接复制）

放在 README 末尾、`docs/usage.md` 开头，以及脚本头部的注释块里，三处措辞保持一致：

```markdown
## 风险提示与免责声明

本脚本与相关文档仅供浏览器自动化技术的学习与研究参考，**不构成任何学习建议、成绩承诺或平台使用指导**。

文中涉及的页面结构、选择器、题库匹配规则与兼容性结论**仅供参考，不替代专业判断**；
优学院可能随时改版，具体表现请以你所在学校的实际页面为准。

**因使用或依赖本项目内容所产生的任何风险与损失，由使用者自行承担**，包括但不限于：
学习记录失效或回退、成绩作废、账号封禁、学校纪律处分、题库答案错误导致的失分。

本项目按"现状"提供，作者 `yyy` 不对答案正确性、平台兼容性与使用结果作任何明示或默示保证。
```

---

## 8. 常见错误与风险清单

| # | 错误 | 后果 | 规避 |
|---|---|---|---|
| 1 | `@updateURL` 路径/分支写错 | 用户永远收不到更新，且无报错 | 发布后用无痕窗口实测一次更新 |
| 2 | tag 与 `@version` 不一致（`v1.0.0` vs `1.0.0.0`） | 篡改猴判定版本异常，不更新 | 固定 tag 带 v、脚本不带 v |
| 3 | 把用户脚本塞进 `src/` | raw 链接失效，老用户更新断链 | 根目录放 `.user.js`，路径当契约 |
| 4 | `@namespace` 用占位地址 | 改仓库名后用户端出现重复脚本 | 用真实仓库 URL |
| 5 | 提交了题库/账号/`.env` | 泄露学校试题、隐私，甚至被封号 | `.gitignore` + push protection + 提交前 grep |
| 6 | 引入 `@require` 第三方 CDN | 供应链风险，CDN 挂则脚本挂 | 保持零运行时依赖 |
| 7 | 为了功能加 `@connect *` | 用户信任崩塌（"它会偷我题目"） | 保持不联网；要联网就单独发一个可选插件 |
| 8 | README 只写"能刷课" | 引来大量"怎么用/没反应"的 issue | 写清不做什么 + 诊断入口 |
| 9 | 没有 LICENSE 文件只有 `@license` | 法律上未授权，企业/学校用户不敢用 | 补 `LICENSE`，两处一致 |
| 10 | CRLF / BOM 提交 | diff 噪音、部分管理器解析头失败 | `.gitattributes` 强制 LF |
| 11 | 首次发布就承诺"支持所有学校定制版" | 无法兑现，口碑反噬 | 明确"仅适配标准域名，定制版自行加 @match" |
| 12 | 用真实姓名+学校署名 | 平台/学校追责时直接定位到人 | 用 GitHub ID 或化名 |
| 13 | Release 只写"bug fix" | 用户不知道要不要升级 | CHANGELOG 写清适配了哪套前端 |
| 14 | 忽略 `@grant` 最小化 | 审核被打回、用户授权弹窗过多 | 只申请用到的 4 个 |

**合规风险（单独强调）**

这个脚本的本质是代替人完成学习过程，多数高校认定为学术不端，优学院用户协议也大概率禁止自动化。开源发布不等于免责：

- MIT 只免除**代码使用**的责任，不免除**使用行为**的责任；
- README 必须写免责声明，且不要暗示"安全不会被发现"；
- 不要提供"防检测/绕过风控"功能，那会把性质从"违规"推向"对抗性规避"，风险和舆论都更高；
- 如果有人用你的仓库做收费代刷，及时在 README 声明"与本项目无关"。

---

## 9. 建议的执行顺序（一页速查）

```
[ ] 确认 §0 的 1/2/3 三项信息
[ ] 改脚本头（§1.2）：namespace / author / updateURL / downloadURL / icon
[ ] 建 LICENSE（§4.1）
[ ] 写 README（§3.1）+ CHANGELOG（§3.2）+ docs/troubleshooting.md
[ ] 建 .gitignore / .gitattributes / package.json（§2.3 / §2.4 / §4.2）
[ ] 跑安全扫描（§5.1），确认零命中
[ ] git init → 首次提交（§6.1）
[ ] gh repo create --public（§6.2）
[ ] 打 tag v1.0.0 → 发 Release 附 .user.js（§6.3）
[ ] 无痕窗口实测安装 + 更新（§6.3 最后一条）
[ ] 开 Secret scanning / 加 issue 模板 / 加 CI（§5.4 / §7.1 / §7.2）
[ ] 观察两周 issue，决定是否上第三方脚本商店（§7.4）
```
