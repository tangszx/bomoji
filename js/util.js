/* 薄肌与自律 · 通用工具 */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') { for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv; }
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'checked') node.checked = true;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ---- 日期 ---- */
const DAY_MS = 86400000;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function strToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = strToDate(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) {
  return Math.round((strToDate(b) - strToDate(a)) / DAY_MS);
}
/* 周一为一周之始 */
function weekStart(s) {
  const d = strToDate(s);
  const wd = (d.getDay() + 6) % 7;
  return addDays(s, -wd);
}
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
function weekdayName(s) {
  return WEEKDAY_NAMES[(strToDate(s).getDay() + 6) % 7];
}
function fmtDateCn(s) {
  const d = strToDate(s);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ---- 1000 米时间：秒 <-> 3'45" ---- */
function parseRunTime(text) {
  if (!text) return null;
  const m = String(text).trim().match(/^(\d+)['′:：分]\s*(\d{1,2})?['"″秒]?$/);
  if (m) {
    const sec = Number(m[1]) * 60 + Number(m[2] || 0);
    return sec > 0 && sec < 1200 ? sec : null;
  }
  const plain = Number(text);
  if (Number.isFinite(plain) && plain >= 60 && plain < 1200) return Math.round(plain);
  return null;
}
function fmtRunTime(sec) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

let toastTimer = null;
function toast(msg, kind) {
  let box = $('#toast');
  if (!box) { box = el('div', { id: 'toast' }); document.body.append(box); }
  box.className = 'toast show' + (kind ? ` toast-${kind}` : '');
  box.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
}

/* 转义用于 innerHTML 的文本 */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* 简易 Markdown 渲染：**粗体**、列表、换行（AI 返回内容用） */
function mdLite(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const safe = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.、]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${safe.replace(/^\s*([-*•]|\d+[.、])\s+/, '')}</li>`);
    } else if (/^#{1,4}\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p class="md-h">${safe.replace(/^#{1,4}\s+/, '')}</p>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${safe}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

/* 复制文本：优先 Clipboard API（需安全上下文），失败回退 execCommand（局域网 http 预览可用） */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* 走回退 */ }
  try {
    const ta = el('textarea', { style: 'position:fixed;top:-999px;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}
