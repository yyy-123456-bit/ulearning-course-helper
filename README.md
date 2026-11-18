# 优学院课件助手

> 优学院（`ulearning.cn` / `umooc.com.cn`）课件页自动播放、播完自动翻页、按**本地题库**自动填练习题。
> 默认 1x 不加速、不模拟鼠标键盘、默认不自动提交、考试页不自动作答。

[![version](https://img.shields.io/badge/version-1.0.0-blue)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20ScriptCat-orange)](#安装)
[![dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](package.json)

## 安装

1. 安装脚本管理器：[Tampermonkey](https://www.tampermonkey.net/)（篡改猴）或 [ScriptCat](https://scriptcat.org/)（脚本猫）；
2. 点此安装（管理器会自动弹出安装页）：

   ```
   https://raw.githubusercontent.com/yyy-123456-bit/ulearning-course-helper/main/ulearning-course-helper.user.js
   ```

3. 打开优学院 → 进入课程 → 「课件」标签，右上角出现蓝色「优学院助手」面板即成功。

> 若面板没出现：确认地址含 `learnCourse` / `homework` / `quiz`，或点管理器菜单里的「显示/隐藏优学院助手」。

## 功能

- ✅ 自动播放、静音、暂停后自动继续
- ✅ 播完自动翻页（连续 3 次无变化自动停止，避免空转）
- ✅ 本地题库自动作答：单选 / 多选 / 判断 / 填空
- ✅ 面板：拖拽、收起、题库导入导出、结构诊断
- ❌ 不加速（默认 1x，手动最高 2x）
- ❌ 不模拟鼠标键盘、不伪造学习时长
- ❌ 考试页不自动作答，所有页面默认不自动提交

## 使用

| 面板项 | 建议 | 说明 |
|---|---|---|
| 静音播放 | 开 | 不打扰，不影响进度统计 |
| 暂停后自动继续 | 开 | 手动暂停后 6 秒内不抢控制权 |
| 播完自动翻页 | 开 | 连续 3 次翻页无变化会自动停 |
| 自动填本页答案 | 开 | 仅在非考试页生效 |
| 自动提交 | **关** | 提交不可撤回，建议先手动核对几次 |
| 处理离开确认弹窗 | 开 | 只点「留在本页 / 取消」，不会替你跳过未完成内容 |
| 播放倍速 | **1.0x** | 平台有学习时长校验，加速易被判异常 |

完整说明见 [docs/usage.md](docs/usage.md)。

## 题库

JSON 数组，字段兼容常见同类脚本（`question`/`q`/`title`、`answer`/`a`/`correctAnswer`）：

```json
[
  { "question": "题干文本", "type": "single", "answer": "B" },
  { "question": "判断题题干", "type": "judgement", "answer": "正确" },
  { "question": "多选题题干", "type": "multiple", "answer": "ABC" }
]
```

- 面板「📥 导入题库」会合并去重，「📤 导出题库」可备份；
- 匹配顺序：完全一致 → 互相包含 → 相似度 ≥ 0.84（二字组 Dice 系数），题号、标点、空格差异不影响；
- 题库只存本地（油猴存储 `ulch_bank`），**脚本不联网、不上传任何数据**；
- 示例文件：[examples/bank.sample.json](examples/bank.sample.json)。

## 兼容性

| 页面 | 状态 | 说明 |
|---|---|---|
| `learnCourse.html` / `learnCourseNew` | ✅ | 播放、翻页、练习作答 |
| `homework.do` 作业 | ✅ | 作答，但不自动提交 |
| `utest` / `exam` 考试 | ⚠️ | 仅手动填充，需二次确认 |
| 课件 PPT 逐页翻页 | ❌ | 无可靠"已看完"标记，不做 |
| 学校定制域名 | ⚠️ | 需自行在 `@match` 增加域名 |

## 排查

点面板 **🔍 诊断**，会复制一段 JSON（视频数、题目容器命中数、选项命中数、翻页按钮、题库条数、首题文本）。
把它贴到 [issue](https://github.com/yyy-123456-bit/ulearning-course-helper/issues/new/choose)，能直接定位问题。
更多见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 风险提示与免责声明

本脚本与相关文档仅供浏览器自动化技术的**学习与研究参考**，**不构成任何学习建议、成绩承诺或平台使用指导**。

文中涉及的页面结构、选择器、题库匹配规则与兼容性结论**仅供参考，不替代专业判断**；优学院可能随时改版，
具体表现请以你所在学校的实际页面为准。

**因使用或依赖本项目内容所产生的任何风险与损失，由使用者自行承担**，包括但不限于：学习记录失效或回退、
成绩作废、账号封禁、学校纪律处分、题库答案错误导致的失分。

本项目按"现状"提供，作者 `yyy` 不对答案正确性、平台兼容性与使用结果作任何明示或默示保证。

## License

[MIT](LICENSE) © 2026 yyy
