#!/usr/bin/env node
// render.mjs — dựng trang web và email từ docs/editions/YYYY-MM-DD.json
// Usage: node tools/render.mjs 2026-11-10
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('Usage: node tools/render.mjs YYYY-MM-DD');
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(resolve(ROOT, 'site.config.json'), 'utf8'));
const edPath = resolve(ROOT, 'docs/editions', `${date}.json`);
if (!existsSync(edPath)) { console.error(`Không thấy ${edPath}`); process.exit(1); }
const ed = JSON.parse(readFileSync(edPath, 'utf8'));
const feedPath = resolve(ROOT, 'docs/feed.json');
const feed = JSON.parse(readFileSync(feedPath, 'utf8'));
const usedPath = resolve(ROOT, 'topics-used.json');
const used = JSON.parse(readFileSync(usedPath, 'utf8'));

// `other` là tên cũ của `society`, giữ để các số cũ vẫn render được.
const normCat = (c) => (c === 'other' ? 'society' : c);
const CAT = { econ: 'Kinh tế & Tài chính', psych: 'Tâm lý con người', ai: 'AI & Mẹo hay', society: 'Xã hội' };
const SHORT = { econ: 'Kinh tế', psych: 'Tâm lý', ai: 'AI', society: 'Xã hội' };
const COLOR = { econ: '#b5521c', psych: '#7a4a86', ai: '#2b6d8d', society: '#4c7a48' };
const KIND = { why: 'Câu hỏi', concept: 'Khái niệm', theory: 'Lý thuyết', fact: 'Fact', tip: 'Mẹo' };
const DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const titleOf = (t) => t.title || t.question || '';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// markdown-lite: **bold**, *italic*
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const pad2 = (n) => String(n).padStart(2, '0');

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${d}/${m}/${y}`;
}
function topicWords(t) {
  return words(t.hook) + t.body.reduce((a, p) => a + words(p), 0) + words(t.example?.text) + words(t.takeaway);
}
const totalWords = ed.topics.reduce((a, t) => a + topicWords(t), 0);
const readMinutes = Math.max(1, Math.round(totalWords / 300));
const catCounts = Object.keys(CAT).map((c) => [c, ed.topics.filter((t) => normCat(t.category) === c).length]).filter(([, n]) => n > 0);

// ---------- feed update ----------
feed.name = cfg.name; feed.tagline = cfg.tagline;
feed.editions = (feed.editions || []).filter((e) => e.date !== ed.date);
feed.editions.push({
  date: ed.date, number: ed.number, readMinutes,
  topics: ed.topics.map((t) => ({ id: t.id, title: titleOf(t), category: normCat(t.category), kind: t.kind || 'why' })),
});
feed.editions.sort((a, b) => (a.date < b.date ? 1 : -1));
const idx = feed.editions.findIndex((e) => e.date === ed.date);
const newer = feed.editions[idx - 1];
const older = feed.editions[idx + 1];

// ---------- topics-used update ----------
const usedFiltered = used.filter((u) => u.date !== ed.date);
for (const t of ed.topics) usedFiltered.push({ date: ed.date, id: t.id, category: normCat(t.category), kind: t.kind || 'why', title: titleOf(t) });
usedFiltered.sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- web page ----------
function articleHTML(t, i) {
  const n = pad2(i + 1);
  const cat = normCat(t.category);
  const srcs = (t.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('');
  const kind = KIND[t.kind] ? `<span class="kind">${esc(KIND[t.kind])}</span>` : '';
  return `
<article class="article cat-${esc(cat)}" id="t${i + 1}">
  <div class="eyebrow"><span class="num">${n}</span><span class="tag ${esc(cat)}">${esc(CAT[cat])}</span>${kind}<span>${esc(t.subcategory || '')}</span></div>
  <h2>${esc(titleOf(t))}</h2>
  <p class="hook">${md(t.hook)}</p>
  <div class="body">${t.body.map((p) => `<p>${md(p)}</p>`).join('\n')}</div>
  ${t.example ? `<aside class="box example"><div class="label">Ví dụ thực tế</div><h3>${esc(t.example.title)}</h3><p>${md(t.example.text)}</p></aside>` : ''}
  <aside class="box takeaway"><div class="label">Mang về nhà</div><p>${md(t.takeaway)}</p></aside>
  ${t.link ? `<p class="link-line">↳ ${linkify(t.link)}</p>` : ''}
  ${srcs ? `<details class="sources"><summary>Nguồn (${t.sources.length})</summary><ul>${srcs}</ul></details>` : ''}
</article>`;
}
function linkify(s) {
  return md(s).replace(/bài số (\d)/gi, (m, n) => `<a href="#t${n}">${m}</a>`);
}

const tocHTML = ed.topics.map((t, i) =>
  `<li><a href="#t${i + 1}"><span class="num">${pad2(i + 1)}</span><span class="q">${esc(titleOf(t))}</span><span class="tag ${esc(normCat(t.category))}">${esc(SHORT[normCat(t.category)])}</span></a></li>`).join('\n');

const page = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Số ${ed.number} · ${fmtDate(ed.date)} · ${esc(cfg.name)}</title>
<meta name="description" content="${esc(ed.topics.map(titleOf).join(' · '))}">
<meta name="theme-color" content="#f4efe6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15130f" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Literata:ital,opsz,wght@0,7..72,500;0,7..72,700;1,7..72,500&display=swap">
<link rel="stylesheet" href="../style.css">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand" href="../">${esc(cfg.name)}<small>Số ${ed.number}</small></a>
    <div class="topbar-actions">
      <a class="iconbtn" href="../" aria-label="Tất cả các số" title="Tất cả các số"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></a>
      <button class="iconbtn" id="themeBtn" aria-label="Đổi sáng tối"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.4A6 6 0 0 1 12 3z"/></svg></button>
    </div>
  </div>
  <div class="progress" id="progress"></div>
</header>

<main class="wrap">
  <section class="masthead">
    <div class="eyebrow">Số ${ed.number}</div>
    <h1>${fmtDate(ed.date)}</h1>
    <div class="meta"><span>5 chủ đề</span><span>${readMinutes} phút đọc</span><span>${catCounts.map(([c, n]) => `${n} ${SHORT[c].toLowerCase()}`).join(' · ')}</span></div>
  </section>

  <p class="intro">${md(ed.intro)}</p>

  <ol class="toc">
${tocHTML}
  </ol>

${ed.topics.map(articleHTML).join('\n')}

  <nav class="edition-nav">
    <a class="prev${older ? '' : ' disabled'}" href="${older ? older.date + '.html' : '#'}"><span>← Số trước</span>${older ? fmtDate(older.date) : 'Đây là số đầu tiên'}</a>
    <a class="next${newer ? '' : ' disabled'}" href="${newer ? newer.date + '.html' : '#'}"><span>Số sau →</span>${newer ? fmtDate(newer.date) : 'Đây là số mới nhất'}</a>
  </nav>
</main>
<footer class="footer wrap">${esc(cfg.name)} · ${esc(cfg.tagline)}</footer>

<script>
(function(){
  var p=document.getElementById('progress');
  function upd(){var h=document.documentElement;var s=h.scrollTop||document.body.scrollTop;var m=h.scrollHeight-h.clientHeight;p.style.width=(m>0?s/m*100:0)+'%';}
  addEventListener('scroll',upd,{passive:true});upd();
  document.getElementById('themeBtn').addEventListener('click',function(){var r=document.documentElement;var c=r.getAttribute('data-theme');var d=matchMedia('(prefers-color-scheme: dark)').matches;var n=c?(c==='dark'?'light':'dark'):(d?'light':'dark');r.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(e){}});
  if('serviceWorker' in navigator){navigator.serviceWorker.register('../sw.js').catch(function(){});}
})();
</script>
</body>
</html>
`;

// ---------- email (inline styles, Gmail-safe; không dùng nháy kép trong style) ----------
const base = (cfg.baseUrl || '').replace(/\/$/, '');
const webUrl = `${base}/editions/${ed.date}.html`;
const E = {
  body: 'margin:0;padding:0;background:#f4efe6;',
  wrap: 'max-width:600px;margin:0 auto;padding:20px 14px 32px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1a17;font-size:16px;line-height:1.6;',
  brand: 'font-family:Georgia,Times New Roman,serif;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#6f685e;margin:0 0 6px;',
  h1: 'font-family:Georgia,Times New Roman,serif;font-size:28px;line-height:1.15;margin:0 0 6px;color:#1c1a17;',
  meta: 'color:#6f685e;font-size:13px;margin:0 0 18px;',
  intro: 'font-family:Georgia,Times New Roman,serif;font-size:18px;line-height:1.5;color:#3d3934;border-left:3px solid #b5521c;padding-left:14px;margin:0 0 22px;',
  card: 'background:#fffdf8;border:1px solid #e3dbcc;border-radius:16px;padding:20px 18px;margin:0 0 16px;',
  h2: 'font-family:Georgia,Times New Roman,serif;font-size:22px;line-height:1.2;margin:8px 0 12px;color:#1c1a17;',
  hook: 'font-size:17px;line-height:1.55;margin:0 0 14px;color:#1c1a17;',
  p: 'margin:0 0 12px;color:#3d3934;',
  exampleBox: 'background:#f9f5ec;border:1px dashed #cfc5b3;border-radius:12px;padding:12px 14px;margin:14px 0;',
  label: 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6f685e;margin:0 0 4px;',
  exTitle: 'font-family:Georgia,serif;font-size:16px;margin:0 0 4px;color:#1c1a17;',
  srcs: 'font-size:13px;color:#6f685e;margin:12px 0 0;padding-top:10px;border-top:1px solid #e3dbcc;',
  btn: 'display:inline-block;background:#b5521c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600;font-size:15px;',
  foot: 'color:#6f685e;font-size:12px;text-align:center;margin:24px 0 0;',
};
function emailTopic(t, i) {
  const cat = normCat(t.category);
  const c = COLOR[cat];
  const kind = KIND[t.kind] ? ` · ${esc(KIND[t.kind])}` : '';
  const tag = `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${c};">${pad2(i + 1)} · ${esc(CAT[cat])}${kind}</span>`;
  const srcs = (t.sources || []).map((s) => `<a href="${esc(s.url)}" style="color:#6f685e;">${esc(s.name)}</a>`).join(' · ');
  return `<div style="${E.card}">
${tag}
<h2 style="${E.h2}">${esc(titleOf(t))}</h2>
<p style="${E.hook}">${md(t.hook)}</p>
${t.body.map((p) => `<p style="${E.p}">${md(p)}</p>`).join('\n')}
${t.example ? `<div style="${E.exampleBox}"><p style="${E.label}">Ví dụ thực tế</p><p style="${E.exTitle}"><b>${esc(t.example.title)}</b></p><p style="margin:0;color:#3d3934;font-size:15px;">${md(t.example.text)}</p></div>` : ''}
<div style="background:#fbf1e8;border-left:4px solid ${c};border-radius:12px;padding:12px 14px;margin:14px 0 0;"><p style="${E.label.replace('#6f685e', c)}">Mang về nhà</p><p style="margin:0;font-family:Georgia,serif;font-size:17px;line-height:1.45;color:#1c1a17;">${md(t.takeaway)}</p></div>
${t.link ? `<p style="margin:12px 0 0;font-size:14px;color:#6f685e;">↳ ${md(t.link)}</p>` : ''}
${srcs ? `<p style="${E.srcs}">Nguồn: ${srcs}</p>` : ''}
</div>`;
}
const email = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(cfg.name)} · Số ${ed.number}</title></head>
<body style="${E.body}">
<div style="${E.wrap}">
  <p style="${E.brand}">${esc(cfg.name)} · Số ${ed.number}</p>
  <h1 style="${E.h1}">${fmtDate(ed.date)}</h1>
  <p style="${E.meta}">5 chủ đề · ${readMinutes} phút đọc · <a href="${esc(webUrl)}" style="color:#b5521c;">Mở bản web</a></p>
  <p style="${E.intro}">${md(ed.intro)}</p>
  <ol style="margin:0 0 20px;padding-left:22px;color:#3d3934;font-size:15px;">
    ${ed.topics.map((t) => `<li style="margin:4px 0;">${esc(titleOf(t))}</li>`).join('\n    ')}
  </ol>
${ed.topics.map(emailTopic).join('\n')}
  <p style="text-align:center;margin:20px 0 0;"><a href="${esc(webUrl)}" style="${E.btn}">Đọc trên web · lưu vào màn hình chính</a></p>
  <p style="${E.foot}">${esc(cfg.tagline)}<br>Toàn bộ các số: <a href="${esc(base)}/" style="color:#6f685e;">${esc(base)}/</a></p>
</div>
</body></html>
`;

// ---------- write ----------
mkdirSync(resolve(ROOT, 'email'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/editions', `${ed.date}.html`), page);
writeFileSync(resolve(ROOT, 'email', `${ed.date}.html`), email);
writeFileSync(feedPath, JSON.stringify(feed, null, 2) + '\n');
writeFileSync(usedPath, JSON.stringify(usedFiltered, null, 2) + '\n');

console.log(`OK  docs/editions/${ed.date}.html  (${totalWords} từ, ~${readMinutes} phút)`);
console.log(`OK  email/${ed.date}.html`);
console.log(`OK  docs/feed.json (${feed.editions.length} số), topics-used.json (${usedFiltered.length} chủ đề)`);
