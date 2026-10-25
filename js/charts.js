/* 薄肌与自律 · 轻量 SVG 图表（遵循 app 图表规范：单色、细线、少网格、无数密集标签） */
'use strict';

const Charts = (() => {

  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }

  /* 读取 CSS 令牌颜色 */
  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#4fe0a8';
  }

  /* 折线图：points = [{x:label, y:number}]，opts: {target:{y,label}, unit, decimals, reversed}
   * reversed：值越小越好（如跑步时间），目标线在下方 */
  function line(container, points, opts = {}) {
    container.innerHTML = '';
    if (!points || !points.length) {
      container.append(emptyNote(opts.emptyText || '还没有数据'));
      return;
    }
    const W = 640, H = 220, padL = 44, padR = 14, padT = 18, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const ys = points.map(p => p.y).concat(opts.target ? [opts.target.y] : []);
    let min = Math.min(...ys), max = Math.max(...ys);
    const span = max - min || Math.abs(max) || 1;
    min -= span * 0.12; max += span * 0.12;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.ariaLabel || '趋势图' });
    const X = i => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const Y = v => padT + (1 - (v - min) / (max - min)) * plotH;

    /* 3-5 条横向网格线 */
    const fmt = opts.fmt || (v => fmtNum(v, opts.decimals));
    const ticks = niceTicks(min, max, 4);
    for (const t of ticks) {
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), class: 'chart-grid' }));
      const lbl = svgEl('text', { x: padL - 8, y: Y(t) + 4, class: 'chart-tick', 'text-anchor': 'end' });
      lbl.textContent = fmt(t);
      svg.append(lbl);
    }

    /* 目标参考线 */
    if (opts.target) {
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: Y(opts.target.y), y2: Y(opts.target.y), class: 'chart-target' }));
      const tl = svgEl('text', { x: W - padR, y: Y(opts.target.y) - 6, class: 'chart-target-label', 'text-anchor': 'end' });
      tl.textContent = opts.target.label || '目标';
      svg.append(tl);
    }

    /* 折线（直线段） */
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    svg.append(svgEl('path', { d, class: 'chart-line' }));

    /* 首末点小圆 + 末点数值 */
    const last = points[points.length - 1];
    const dot = svgEl('circle', { cx: X(points.length - 1), cy: Y(last.y), r: 4, class: 'chart-dot' });
    svg.append(dot);
    const vl = svgEl('text', { x: X(points.length - 1), y: Y(last.y) - 10, class: 'chart-value', 'text-anchor': (points.length - 1) / (points.length - 1) > 0.85 ? 'end' : 'middle' });
    vl.textContent = fmt(last.y) + (opts.unit ? ' ' + opts.unit : '');
    svg.append(vl);

    /* x 轴标签：最多 5 个 */
    const step = Math.ceil(points.length / 5);
    points.forEach((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return;
      const t = svgEl('text', { x: X(i), y: H - 8, class: 'chart-tick', 'text-anchor': i === 0 ? 'start' : (i === points.length - 1 ? 'end' : 'middle') });
      t.textContent = p.x;
      svg.append(t);
    });

    container.append(svg);
  }

  /* 柱状图（睡眠时长等）：points 同上 */
  function bars(container, points, opts = {}) {
    container.innerHTML = '';
    if (!points || !points.length) {
      container.append(emptyNote(opts.emptyText || '还没有数据'));
      return;
    }
    const W = 640, H = 200, padL = 44, padR = 10, padT = 14, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxV = Math.max(...points.map(p => p.y), opts.max || 0);
    const top = niceCeil(maxV);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.ariaLabel || '柱状图' });
    const bw = Math.min(28, (plotW / points.length) * 0.55);

    const ticks = niceTicks(0, top, 3);
    for (const t of ticks) {
      const y = padT + (1 - t / top) * plotH;
      svg.append(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'chart-grid' }));
      const lbl = svgEl('text', { x: padL - 8, y: y + 4, class: 'chart-tick', 'text-anchor': 'end' });
      lbl.textContent = fmtNum(t, 0);
      svg.append(lbl);
    }

    points.forEach((p, i) => {
      const cx = padL + (i + 0.5) * (plotW / points.length);
      const h = p.y > 0 ? Math.max(2, (p.y / top) * plotH) : 0;
      if (h > 0) {
        svg.append(svgEl('rect', { x: cx - bw / 2, y: padT + plotH - h, width: bw, height: h, class: 'chart-bar' + (p.weak ? ' chart-bar-weak' : '') }));
      }
      if (points.length <= 10 || i % Math.ceil(points.length / 7) === 0) {
        const t = svgEl('text', { x: cx, y: H - 8, class: 'chart-tick', 'text-anchor': 'middle' });
        t.textContent = p.x;
        svg.append(t);
      }
    });
    container.append(svg);
  }

  /* 进度条（两端标注） */
  function progress(container, ratio, leftLabel, rightLabel) {
    const r = clamp(ratio, 0, 1);
    container.innerHTML = '';
    const wrap = el('div', { class: 'progress-wrap' });
    const track = el('div', { class: 'progress-track' });
    const fill = el('div', { class: 'progress-fill', style: `width:${(r * 100).toFixed(1)}%` });
    track.append(fill);
    const labels = el('div', { class: 'progress-labels' },
      el('span', {}, leftLabel), el('span', {}, rightLabel));
    wrap.append(track, labels);
    container.append(wrap);
  }

  /* 进度条（返回独立节点） */
  function progressNode(ratio, leftLabel, rightLabel) {
    const box = el('div', { class: 'progress-box' });
    progress(box, ratio, leftLabel, rightLabel);
    return box;
  }

  function niceTicks(min, max, n) {
    const span = max - min;
    const step0 = span / (n + 1);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    /* 向上取整到「好看」的步长，保证总量 3-6 条刻度 */
    const step = (norm >= 7 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let t = Math.ceil(min / step) * step; t < max; t += step) out.push(Number(t.toFixed(6)));
    return out;
  }
  function niceCeil(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
  }
  function fmtNum(v, decimals) {
    const d = decimals !== undefined ? decimals : (Math.abs(v) >= 10 ? 0 : 1);
    return Number(v).toFixed(d).replace(/\.0+$/, '');
  }
  function emptyNote(text) {
    const box = el('div', { class: 'chart-empty' });
    const svg = svgEl('svg', { viewBox: '0 0 640 160', class: 'chart' });
    svg.append(svgEl('line', { x1: 44, x2: 630, y1: 120, y2: 120, class: 'chart-grid' }));
    box.append(svg, el('p', { class: 'chart-empty-note' }, text));
    return box;
  }

  return { line, bars, progress, progressNode };
})();
