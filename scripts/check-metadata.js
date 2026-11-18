#!/usr/bin/env node
/**
 * 用户脚本元数据校验：发布前的最后一道闸。
 * 校验项：必备键、版本号格式、@namespace 归属、更新地址与仓库一致性、禁用远程加载。
 * 用法：node scripts/check-metadata.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'ulearning-course-helper.user.js');
const OWNER = 'yyy-123456-bit';
const REPO = 'ulearning-course-helper';
const FILENAME = 'ulearning-course-helper.user.js';

const src = fs.readFileSync(FILE, 'utf8');
const m = src.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
if (!m) {
  console.error('✗ 未找到 UserScript 头（==UserScript== ... ==/UserScript==）');
  process.exit(1);
}

const head = m[1];
const meta = {};
for (const line of head.split(/\r?\n/)) {
  const hit = line.match(/^\s*\/\/\s*@([\w:-]+)\s+(.*)$/);
  if (!hit) continue;
  const key = hit[1];
  (meta[key] = meta[key] || []).push(hit[2].trim());
}

const errors = [];
const warns = [];

const required = ['name', 'namespace', 'version', 'description', 'author', 'match', 'grant', 'license', 'homepageURL', 'supportURL', 'updateURL', 'downloadURL'];
for (const k of required) {
  if (!meta[k]) errors.push(`缺少 @${k}`);
}

if (meta.version && !/^\d+\.\d+\.\d+$/.test(meta.version[0])) {
  errors.push(`@version 必须是 x.y.z（当前 ${meta.version[0]}），不要带 v 前缀`);
}

if (meta.namespace && !meta.namespace[0].includes(`github.com/${OWNER}/${REPO}`)) {
  errors.push(`@namespace 应指向仓库地址，当前 ${meta.namespace[0]}`);
}

for (const key of ['updateURL', 'downloadURL']) {
  const v = meta[key] && meta[key][0];
  if (!v) continue;
  if (!v.startsWith('https://')) errors.push(`@${key} 必须是 https`);
  if (!v.endsWith(FILENAME)) errors.push(`@${key} 必须指向 ${FILENAME}`);
  if (!v.includes(OWNER) || !v.includes(REPO)) errors.push(`@${key} 与仓库 ${OWNER}/${REPO} 不一致`);
}

if (meta.match && meta.match.length < 1) errors.push('至少需要一个 @match');

for (const banned of ['require', 'connect', 'resource']) {
  if (meta[banned]) errors.push(`不允许 @${banned}（远程加载会引入供应链风险）`);
}

if (/eval\s*\(|new\s+Function\s*\(/.test(src)) {
  errors.push('源码中出现 eval / new Function，请移除');
}

if (!meta.author || meta.author[0] !== 'yyy') {
  warns.push(`@author 期望为 yyy，当前 ${meta.author ? meta.author[0] : '空'}`);
}

if (meta.grant && meta.grant.length > 6) {
  warns.push(`@grant 申请了 ${meta.grant.length} 项，确认都是必需的`);
}

const ver = meta.version ? meta.version[0] : '';
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
if (ver && !changelog.includes(`## [${ver}]`)) {
  warns.push(`CHANGELOG.md 中没有 ${ver} 的记录`);
}

for (const w of warns) console.warn('⚠ ' + w);
if (errors.length) {
  for (const e of errors) console.error('✗ ' + e);
  process.exit(1);
}
console.log(`✓ 元数据校验通过：${meta.name[0]} v${ver}`);
