# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Docs

- 新增 `docs/global-speed.md`：Edge 扩展商店安装 Global Speed、授权、倍速设置、快捷键与风险说明
- 说明 Global Speed 与本脚本倍速设置的互相覆盖问题，并给出三种共存方案
- README 增加「可选：浏览器级倍速」章节；排查手册补充对应条目（编号 6）

## [1.0.0] - 2026-11-18

### Added

- 视频自动播放、静音、手动暂停后自动恢复（6 秒缓冲期，不抢控制权）
- 播完自动翻页：`ended` 事件 + 剩余时长兜底；连续 3 次无变化自动停止
- 本地题库自动作答：单选 / 多选 / 判断 / 填空；支持 Element UI 的 `ul-radio` / `ul-checkbox` 结构
- 判断题图标识别（`icon-zhengque` / `icon-cuowu1`）
- 控制面板：拖拽、收起、题库导入导出、结构诊断（复制 JSON 到剪贴板）
- iframe 场景：子页面通过 `postMessage` 回传视频进度与播完事件
- 题库兼容：`ulch_bank`，并兼容读取 `ul_qbank` / `qbank`

### Security

- 不加载任何远程代码（无 `@require`），不发起任何网络请求（无 `@connect`），题库仅存本地
- `@grant` 仅申请实际使用的四项权限

### Known Limitations

- 课件 PPT 逐页翻页未实现（缺少可靠的"已看完"标记）
- 考试页（`utest` / `exam`）不自动作答、不自动提交
- 学校定制域名需自行在 `@match` 中追加

[1.0.0]: https://github.com/yyy-123456-bit/ulearning-course-helper/releases/tag/v1.0.0
