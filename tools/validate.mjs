#!/usr/bin/env node
// validate.mjs — kiểm tra một số trước khi render.
// Usage: node tools/validate.mjs 2026-11-10   (exit 1 nếu có ERROR)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { console.error('Usage: node tools/validate.mjs YYYY-MM-DD'); process.exit(1); }

const path = resolve(ROOT, 'docs/editions', `${date}.json`);
if (!existsSync(path)) { console.error(`ERROR  không thấy ${path}`); process.exit(1); }

let ed;
try { ed = JSON.parse(readFileSync(path, 'utf8')); }
catch (e) { console.error(`ERROR  JSON không hợp lệ: ${e.message}`); process.exit(1); }

const used = JSON.parse(readFileSync(resolve(ROOT, 'topics-used.json'), 'utf8'));
const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Lịch xoay theo thứ (0 = Chủ Nhật)
const QUOTA = {
  1: { econ: 4, ai: 1, other: 0 }, 2: { econ: 3, ai: 1, other: 1 }, 3: { econ: 4, ai: 0, other: 1 },
  4: { econ: 3, ai: 1, other: 1 }, 5: { econ: 4, ai: 1, other: 0 }, 6: { econ: 3, ai: 1, other: 1 },
  0: { econ: 4, ai: 0, other: 1 },
};

if (ed.date !== date) err(`date trong JSON (${ed.date}) khác tên file (${date})`);
if (!Number.isInteger(ed.number) || ed.number < 1) err('number phải là số nguyên dương');
if (!ed.intro) err('thiếu intro'); else if (words(ed.intro) > 80) warn(`intro dài ${words(ed.intro)} từ (tối đa 70)`);
if (!Array.isArray(ed.topics) || ed.topics.length !== 5) err(`phải có đúng 5 topics, hiện có ${ed.topics?.length ?? 0}`);

const [y, m, d] = date.split('-').map(Number);
const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const count = { econ: 0, ai: 0, other: 0 };
const ids = new Set();
const QSTART = /^(Tại sao|Vì sao|Điều gì|Làm thế nào|Làm sao|Có thật|Chuyện gì)/;

const cutoff = new Date(Date.UTC(y, m - 1, d)); cutoff.setUTCDate(cutoff.getUTCDate() - 120);
const recentUsed = used.filter((u) => u.date !== date && new Date(u.date + 'T00:00:00Z') >= cutoff);
const tokens = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
const overlap = (a, b) => { const A = tokens(a), B = tokens(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };

(ed.topics || []).forEach((t, i) => {
  const tag = `bài ${i + 1}`;
  if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) err(`${tag}: id phải là chữ thường/gạch nối`);
  if (ids.has(t.id)) err(`${tag}: id trùng trong cùng số`); ids.add(t.id);
  if (!['econ', 'ai', 'other'].includes(t.category)) err(`${tag}: category không hợp lệ (${t.category})`); else count[t.category]++;
  if (!t.question) err(`${tag}: thiếu question`);
  else {
    if (!QSTART.test(t.question.trim())) warn(`${tag}: question nên bắt đầu bằng "Tại sao / Vì sao / Điều gì / Làm thế nào / Có thật"`);
    if (words(t.question) > 22) warn(`${tag}: question dài ${words(t.question)} từ (tối đa 20)`);
  }
  if (!t.hook) err(`${tag}: thiếu hook`); else if (words(t.hook) > 100) warn(`${tag}: hook dài ${words(t.hook)} từ (tối đa 90)`);
  if (!Array.isArray(t.body) || t.body.length < 2) err(`${tag}: body cần 3 đến 4 đoạn`);
  else {
    if (t.body.length > 5) warn(`${tag}: body có ${t.body.length} đoạn (nên 3 đến 4)`);
    t.body.forEach((p, j) => { const w = words(p); if (w > 140) warn(`${tag}: đoạn ${j + 1} dài ${w} từ (nên dưới 120)`); });
    const bolds = t.body.join(' ').match(/\*\*[^*]+\*\*/g) || [];
    if (bolds.length === 0) warn(`${tag}: chưa in đậm thuật ngữ nào`);
    if (bolds.length > 4) warn(`${tag}: in đậm ${bolds.length} chỗ (tối đa 3)`);
  }
  if (!t.example || !t.example.title || !t.example.text) err(`${tag}: thiếu example.title hoặc example.text`);
  if (!t.takeaway) err(`${tag}: thiếu takeaway`); else if (words(t.takeaway) > 45) warn(`${tag}: takeaway dài ${words(t.takeaway)} từ (tối đa 40)`);
  if (!Array.isArray(t.sources) || t.sources.length < 2) err(`${tag}: cần ít nhất 2 sources`);
  else t.sources.forEach((s, j) => { if (!s.name || !/^https?:\/\//.test(s.url || '')) err(`${tag}: source ${j + 1} thiếu name hoặc url không hợp lệ`); });

  const total = words(t.hook) + (t.body || []).reduce((a, p) => a + words(p), 0) + words(t.example?.text) + words(t.takeaway);
  if (total < 250) warn(`${tag}: chỉ ${total} từ (nên 300 đến 550)`);
  if (total > 650) warn(`${tag}: ${total} từ (nên 300 đến 550)`);

  for (const u of recentUsed) {
    if (u.id === t.id) err(`${tag}: id "${t.id}" đã dùng ngày ${u.date}`);
    else if (overlap(u.question, t.question) >= 0.6) warn(`${tag}: câu hỏi giống bài ngày ${u.date}: "${u.question}"`);
  }
  if (/[!]{1}/.test(t.body?.join(' ') || '')) warn(`${tag}: có dấu chấm than trong phần cơ chế`);
});

const q = QUOTA[dow];
if (ed.topics?.length === 5 && (count.econ !== q.econ || count.ai !== q.ai || count.other !== q.other)) {
  warn(`quota hôm nay (thứ ${dow === 0 ? 'CN' : dow + 1}) là econ ${q.econ} / ai ${q.ai} / other ${q.other}; hiện có econ ${count.econ} / ai ${count.ai} / other ${count.other}`);
}
const links = (ed.topics || []).filter((t) => t.link).length;
if (links < 2) warn(`chỉ ${links} bài có link nối sang bài khác (cần ít nhất 2)`);

for (const w of warns) console.log(`WARN   ${w}`);
for (const e of errors) console.log(`ERROR  ${e}`);
console.log(errors.length ? `\n${errors.length} lỗi, ${warns.length} cảnh báo` : `\nOK — 0 lỗi, ${warns.length} cảnh báo`);
process.exit(errors.length ? 1 : 0);
