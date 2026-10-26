/* 薄肌与自律 · 主界面：路由 + 视图渲染 + 交互 */
'use strict';

/* global Store, Plan, Safety, Charts, AI */

const ui = { weekOffset: 0, expanded: {}, route: 'today' };

/* ---------- 图标（内联 SVG，描边风格） ---------- */
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L9.8 22l8.7-11.5H12L13 2z"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 1.5-3 4-3M17.5 7c1.5-1 1.5-3 0-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
};
function icon(name) { return `<span class="ic" aria-hidden="true">${ICONS[name]}</span>`; }

const NAV = [
  { id: 'today', label: '今日' },
  { id: 'plan', label: '计划' },
  { id: 'log', label: '记录' },
  { id: 'fuel', label: '饮食作息' },
  { id: 'settings', label: '设置' },
];

/* ---------- 通用小组件 ---------- */

function wordmark() {
  return el('div', { class: 'wordmark' },
    el('span', { class: 'mark', 'aria-hidden': 'true' }),
    el('span', { class: 'mark-name' }, '薄肌与自律'));
}

function countdownChip() {
  const p = Store.profile();
  if (!p.examDate) return el('button', { class: 'chip chip-action', onclick: () => { location.hash = '#settings'; } }, '设置中考日期');
  const d = daysBetween(todayStr(), p.examDate);
  const text = d > 0 ? ['距中考 ', el('b', { class: 'num accent' }, String(d)), ' 天'] : d === 0 ? ['今天中考 · 加油'] : ['中考已结束'];
  return el('span', { class: 'chip' }, ...text);
}

function appHeader(title, subline) {
  return el('header', { class: 'app-header' },
    el('div', { class: 'header-top' }, wordmark(), countdownChip()),
    el('h1', {}, title),
    subline ? el('p', { class: 'subline' }, subline) : null);
}

function card(title, ...body) {
  return el('section', { class: 'card' },
    title ? el('h2', { class: 'card-title' }, title) : null, ...body);
}

/* 课表条目（可展开） */
function planItem(date, it, idx, checkin) {
  const key = `${date}#${idx}`;
  const done = checkin.planDone.includes(key);
  const isRest = it.tag === 'rest';
  const open = !!ui.expanded[key];
  const row = el('div', { class: 'plan-item' + (isRest ? ' is-rest' : '') + (done ? ' is-done' : '') },
    el('div', { class: 'plan-item-row', role: 'button', tabindex: '0', 'aria-expanded': String(open),
      onclick: () => { if (!isRest) { ui.expanded[key] = !open; render(); } },
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.querySelector('.plan-item-row').click(); } } },
      !isRest
        ? el('button', {
            class: 'check' + (done ? ' checked' : ''), 'aria-label': done ? '标记为未完成' : '标记为已完成',
            onclick: e => { e.stopPropagation(); toggleDone(date, key, checkin); },
          }, done ? '✓' : '')
        : el('span', { class: 'check is-dash', 'aria-hidden': 'true' }, '–'),
      el('span', { class: 'plan-item-name' }, it.name),
      el('span', { class: 'plan-item-min num' }, it.min ? `${it.min} 分钟` : ''),
      open || isRest ? null : el('span', { class: 'chev', html: ICONS.chevron, 'aria-hidden': 'true' })),
    open || isRest ? el('p', { class: 'plan-item-detail' }, it.detail) : null);
  return row;
}

function toggleDone(date, key, checkin) {
  const i = checkin.planDone.indexOf(key);
  if (i >= 0) checkin.planDone.splice(i, 1);
  else checkin.planDone.push(key);
  Store.save();
  render();
}

function dayAllDone(day, checkin) {
  const mains = day.items.filter(it => it.tag !== 'rest');
  return mains.length > 0 && mains.every((it, idx) => checkin.planDone.includes(`${day.date}#${day.items.indexOf(it)}`));
}

/* ---------- 今日 ---------- */

function viewToday() {
  const today = todayStr();
  const c = Store.checkin(today);
  const week = Plan.buildWeek(weekStart(today), Store);
  const day = week.days.find(d => d.date === today) || week.days[0];
  const prof = Store.profile();
  const parts = [];

  const subParts = [week.phaseName, weekdayName(today)];
  if (!week.inRecovery && day.focus && day.focus !== '休息') subParts.push(day.focus + '日');
  const streakN = Store.streak();
  if (streakN > 0) subParts.push('连续 ' + streakN + ' 天');
  parts.push(appHeader('今日', subParts.join(' · ')));

  /* 新手三步引导 */
  if (!Store.state.ui.guideDismissed) {
    parts.push(card('第一次用？三步上手',
      el('div', { class: 'info-block' }, el('p', {}, '① 每天打开「今日」照着练：工作日是 20-30 分钟短课，主课集中在周六，做完一项勾一项。')),
      el('div', { class: 'info-block' }, el('p', {}, '② 练完点「训练后打卡」如实填状态——强度调整和安全提醒全靠它，两分钟的事。')),
      el('div', { class: 'info-block' }, el('p', {}, '③ 隔周的周六是「测试日」，测完把成绩记进「记录」——考前预估和 AI 全靠它变准。')),
      el('button', {
        class: 'btn btn-ghost sm', onclick: () => {
          Store.state.ui.guideDismissed = true; Store.save(); render();
        },
      }, '知道了，开始')));
  }

  /* 考试日 / 前夜 */
  if (prof.examDate === today) {
    parts.push(el('div', { class: 'notice notice-stop' },
      el('h3', {}, '今天是考试日'),
      el('p', {}, '按演练过的流程来：提前 90 分钟到场，慢跑＋动态拉伸充分热身；1000 米前 200 米跟住大部队、中段稳节奏、最后 300 米提速；跳远记住摆臂和收腹；引体全幅度、节奏稳。你已经准备好了，正常发挥就好。')));
  } else if (prof.examDate && daysBetween(today, prof.examDate) === 1) {
    parts.push(el('div', { class: 'notice notice-warn' },
      el('h3', {}, '明天中考'),
      el('p', {}, '今天只做热身演练或完全休息；晚饭多吃主食，22:30 前睡觉；把考试要穿的鞋、衣服放好。不要再做任何力量和冲刺。')));
  }

  /* 今日训练 */
  const mains = day.items.filter(it => it.tag !== 'rest');
  parts.push(card(day.focus === '休息' ? '今日 · 休息日' : `今日训练 · ${day.focus}`,
    el('div', { class: 'plan-list' }, day.items.map((it, idx) => planItem(today, it, idx, c))),
    mains.length ? el('button', { class: 'btn btn-primary', onclick: () => openQuiz() }, '训练后打卡 · 记录状态') : el('button', { class: 'btn btn-primary', onclick: () => openQuiz() }, '记录状态（今天原计划休息）'),
    mains.length && dayAllDone(day, c) ? el('p', { class: 'done-note accent' }, '今日训练已完成 ✓') : null));

  /* 备份提醒：数据只在本机，丢设备=丢一切 */
  const lastBk = Store.state.ui.lastBackupAt;
  const daysSinceBk = lastBk ? daysBetween(lastBk, today) : null;
  const usedDays = Store.state.startDate ? daysBetween(Store.state.startDate, today) : 0;
  const examNear = prof.examDate ? daysBetween(today, prof.examDate) <= 14 && daysBetween(today, prof.examDate) >= 0 : false;
  const stale = lastBk ? daysSinceBk >= 30 : usedDays >= 14;
  if (stale || (examNear && daysSinceBk !== null && daysSinceBk >= 14)) {
    parts.push(el('div', { class: 'notice notice-warn' },
      el('h3', {}, '备份一下你的数据'),
      el('p', {}, lastBk
        ? `上次备份是 ${fmtDateCn(lastBk)}。数据只存在这台设备里，换个手机或清了浏览器就没了——花 5 秒导出一份。`
        : '你还没导出过备份。数据只存在这台设备的浏览器里，导出一份 JSON 存到云盘/备忘录更安心。'),
      el('button', { class: 'btn btn-ghost', onclick: () => { doExport(); render(); } }, '导出备份')));
  }

  /* 训练后状态卡 */
  if (c.workout) parts.push(statusCard(today, c));

  /* 本周概览 */
  const trainingDays = week.days.filter(d => d.items.some(it => it.tag !== 'rest'));
  const doneCount = trainingDays.filter(d => dayAllDone(d, Store.checkin(d.date))).length;
  parts.push(card('本周概览',
    el('div', { class: 'week-strip' }, week.days.map(d => {
      const hasT = d.items.some(it => it.tag !== 'rest');
      const done = hasT && dayAllDone(d, Store.checkin(d.date));
      const isToday = d.date === today;
      return el('div', { class: 'week-cell' },
        el('span', { class: 'week-d' + (isToday ? ' is-today' : '') }, d.weekday.slice(1)),
        el('span', { class: 'week-dot' + (done ? ' is-done' : hasT ? ' is-todo' : ' is-rest') }));
    })),
    Charts.progressNode(trainingDays.length ? doneCount / trainingDays.length : 0,
      `已完成 ${doneCount} / ${trainingDays.length} 节`, `本周目标 ${trainingDays.length} 节`)));

  return el('div', { class: 'view' }, ...parts);
}

/* 三项目考前预估（记录 ≥2 条才出，少时明确说数据不足） */
function examProjection() {
  const prof = Store.profile();
  if (!prof.examDate) return null;
  const defs = [
    {
      id: 'run1000', name: '1000 米', lowerBetter: true, kind: 'time',
      fmt: v => fmtRunTime(Math.round(v)), rateFmt: v => fmtRunTime(Math.abs(Math.round(v))) + '/周',
    },
    {
      id: 'jump', name: '立定跳远', lowerBetter: false, kind: 'distance',
      fmt: v => v.toFixed(2) + ' 米', rateFmt: v => Math.abs(v).toFixed(2) + ' 米/周',
    },
    {
      id: 'pullups', name: '引体向上', lowerBetter: false, kind: 'count',
      fmt: v => Math.round(v) + ' 个', rateFmt: v => Math.abs(Math.round(v)) + ' 个/周',
    },
  ];
  const rows = [];
  let any = false;
  for (const d of defs) {
    const recs = Store.state.records.filter(r => r.event === d.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    const p = Plan.project(recs, prof.targets[d.id], prof.examDate, todayStr(), d.lowerBetter, d.kind);
    if (!p) { rows.push({ name: d.name, text: '——', verdict: '记录 2 次后开启', ok: false }); continue; }
    any = true;
    rows.push({
      name: d.name,
      text: `考试日约 ${d.fmt(p.projected)}`,
      verdict: p.verdict + (p.confident ? '' : '（数据少）') + ` · 每周${p.improving >= 0 ? '+' : '-'}${d.rateFmt(p.improving)}`,
      ok: p.achieved,
    });
  }
  if (!any) return null;
  const note = prof.recovery.legSurgery && !prof.recovery.doctorClear
    ? '注：当前处于康复期，跳类成绩未恢复属正常，预估仅供方向参考。'
    : '趋势基于已录成绩的直线外推——训练不是直线，波动正常，预估随每次测试自动变准。';
  return { rows, note };
}

/* 状态卡（本地规则评估 + AI 深度分析入口；当天的分析结果会回显） */
function statusCard(date, c) {
  const history = Object.keys(Store.state.checkins).sort().map(k => Store.state.checkins[k].workout).filter(Boolean);
  const q = { ...c.workout, waterMl: c.waterMl || null };
  const result = Safety.evaluate(q, history, Store.profile());
  const cls = { ok: 'notice-ok', caution: 'notice-warn', stop: 'notice-stop' }[result.level];
  const box = el('div', { class: 'notice ' + cls });
  box.append(el('h3', {}, `训练后状态 · ${result.title}`));
  box.append(...result.advice.map(a => el('p', {}, a)));

  const aiWrap = el('div', { class: 'ai-result' });
  const savedList = Store.state.analyses.filter(a => a.kind === 'status' && a.date === date);
  const lastSaved = savedList.length ? savedList[savedList.length - 1] : null;
  if (lastSaved) {
    const prev = el('div', { class: 'ai-body' });
    prev.innerHTML = mdLite(lastSaved.content);
    aiWrap.append(prev);
  }
  box.append(el('div', { class: 'btn-row' },
    AI.configured()
      ? el('button', {
          class: 'btn btn-ghost', onclick: async e => {
            const b = e.currentTarget;
            b.disabled = true; b.textContent = 'AI 分析中…';
            try {
              const text = await AI.analyzeStatus(c);
              Store.state.analyses.push({ date, kind: 'status', content: text });
              if (Store.state.analyses.length > 50) Store.state.analyses = Store.state.analyses.slice(-50);
              Store.save();
              aiWrap.innerHTML = '';
              const body = el('div', { class: 'ai-body' });
              body.innerHTML = mdLite(text);
              aiWrap.append(body);
              b.textContent = '重新分析';
            } catch (err) {
              showAIError(aiWrap, err, 'status');
              b.disabled = false; b.textContent = lastSaved ? '重新分析' : 'AI 深度分析';
            }
          },
        }, lastSaved ? '重新分析' : 'AI 深度分析')
      : el('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#settings'; } }, '填入 API Key 开启 AI 分析')));
  box.append(aiWrap);
  return box;
}

/* AI 调用失败的降级：跨域/网络问题时可复制提示词到任意 AI 助手 */
function showAIError(wrap, err, kind) {
  wrap.innerHTML = '';
  const isNet = err.message === 'NETWORK';
  wrap.append(el('p', { class: 'ai-error' },
    isNet ? '直连失败：服务商不允许浏览器跨域直连（或网络不通）。' : `调用失败：${err.message}`));
  wrap.append(el('p', { class: 'muted small' },
    '① 点下方按钮复制提示词，粘贴给任意 AI 助手即可分析；② 想让 app 内一键 AI 全自动：换用 DeepSeek（设置里一键切换）。'));
  wrap.append(el('button', {
    class: 'btn btn-ghost',
    onclick: async () => {
      const text = kind === 'status' ? AI.statusContext(Store.checkin(todayStr())) : AI.planContext();
      const full = text + '\n\n（请基于以上数据给出分析与建议，注意我处于手术康复期，安全第一。）';
      const ok = await copyText(full);
      toast(ok ? '提示词已复制，粘贴给任意 AI 助手即可' : '复制失败，请手动长按选择文本', ok ? undefined : 'bad');
    },
  }, '复制提示词 → 粘贴给任意 AI'));
}

/* ---------- 计划 ---------- */

function viewPlan() {
  const today = todayStr();
  const weekStartDate = addDays(weekStart(today), ui.weekOffset * 7);
  const week = Plan.buildWeek(weekStartDate, Store);
  const prof = Store.profile();
  const parts = [];

  const rel = ui.weekOffset === 0 ? '本周' : ui.weekOffset === 1 ? '下周' : ui.weekOffset === -1 ? '上周' : `${ui.weekOffset > 0 ? '后' : '前'} ${Math.abs(ui.weekOffset)} 周`;
  parts.push(appHeader('训练计划', `${rel} · ${week.phaseName}${week.deload ? ' · 减量周' : ''}`));

  /* 考前预估 */
  const proj = examProjection();
  if (proj) {
    parts.push(card('考前预估（按已录成绩的趋势推算）',
      el('div', { class: 'proj-list' }, proj.rows.map(row =>
        el('div', { class: 'proj-row' },
          el('span', { class: 'proj-name' }, row.name),
          el('span', { class: 'proj-val num' }, row.text),
          el('span', { class: 'proj-verdict ' + (row.ok ? 'accent' : 'muted') }, row.verdict)))),
      el('p', { class: 'muted small' }, proj.note),
      el('p', { class: 'muted small' }, '预估会随每次测试自动变准；它在提醒方向，不是承诺。')));
  }

  /* 康复提醒横幅 */
  if (prof.recovery.legSurgery && !prof.recovery.doctorClear) {
    parts.push(el('div', { class: 'notice notice-warn' },
      el('h3', {}, '手术康复提醒'),
      el('p', {}, `当前按康复分期渐进（${Plan.RECOVERY_NAMES[week.stage] || '正常'}），跳跃强度逐周增加。请尽快复诊让手术医生确认「可以正常跑步和跳跃」，确认后到设置里勾选，计划会自动进入正常节奏。`)));
  }

  /* 周切换 + 每周天数 */
  parts.push(el('div', { class: 'toolbar' },
    el('div', { class: 'seg' }, ['◀', '本周', '▶'].map((t, i) => el('button', {
      class: 'seg-btn', 'aria-label': ['上一周', '回到本周', '下一周'][i],
      onclick: () => { ui.weekOffset += [-1, -ui.weekOffset, 1][i]; render(); },
    }, t))),
    el('div', { class: 'seg seg-days' }, [3, 4, 5, 6].map(n => el('button', {
      class: 'seg-btn' + (prof.daysPerWeek === n ? ' active' : ''),
      onclick: () => { prof.daysPerWeek = n; Store.save(); render(); },
    }, n + ' 天')))));

  /* AI 调整计划的说明（课表本身已由 buildWeek 集成，可直接勾选打卡） */
  const aiPlan = Store.state.aiPlan;
  if (aiPlan && aiPlan.forWeekStart === weekStartDate) {
    parts.push(el('div', { class: 'notice notice-ok' },
      el('h3', {}, '本周是 AI 调整的计划'),
      aiPlan.reason ? el('p', {}, aiPlan.reason) : null,
      el('p', { class: 'muted small' }, '照常勾选打卡即可，完成度会计入本周概览。')));
  }

  /* 一周课表 */
  parts.push(card(`课表（${prof.daysPerWeek} 天/周 · 工作日短课 周末主课）`,
    el('p', { class: 'muted small' },
      week.inRecovery ? '目标：让手术腿安全承压，跳跃强度逐周渐进，骨头比你想象的需要更多耐心' : Plan.PHASE_INTENT[week.phase]),
    el('div', { class: 'plan-list' }, week.days.map(d => {
      const checkin = Store.checkin(d.date);
      const isToday = d.date === today;
      return el('div', { class: 'plan-day' + (isToday ? ' is-today' : '') },
        el('div', { class: 'plan-day-head' },
          el('span', { class: 'plan-day-w' + (isToday ? ' accent' : '') }, d.weekday),
          el('span', { class: 'plan-day-date num' }, fmtDateCn(d.date)),
          el('span', { class: 'plan-day-focus' }, d.focus)),
        d.items.map((it, idx) => planItem(d.date, it, idx, checkin)));
    }))));

  /* AI 调整入口 */
  parts.push(card('计划微调',
    el('p', { class: 'muted' }, aiPlan
      ? '本周已在用 AI 调整的计划，按上面课表正常勾选打卡。觉得不合适可弃用恢复标准课表。'
      : 'AI 会根据你近两周的打卡、成绩和疲劳情况调整下周训练。建议每周日晚上生成一次。'),
    el('div', { class: 'btn-row' },
      aiPlan ? el('button', {
        class: 'btn btn-ghost', onclick: () => { Store.state.aiPlan = null; Store.save(); toast('已弃用 AI 计划，恢复标准课表'); render(); },
      }, '弃用 AI 计划') : null,
      AI.configured()
        ? el('button', {
            class: 'btn btn-primary', onclick: async e => {
              const b = e.currentTarget;
              b.disabled = true; b.textContent = 'AI 正在生成下周计划…';
              try {
                const plan = await AI.adjustPlan();
                Store.state.aiPlan = plan;
                Store.save();
                toast('下周计划已生成');
                ui.weekOffset = 1;
                render(true);
              } catch (err) {
                b.disabled = false; b.textContent = 'AI 调整下周计划';
                const wrap = el('div', { class: 'ai-result' });
                b.closest('.card').append(wrap);
                showAIError(wrap, err, 'plan');
              }
            },
          }, 'AI 调整下周计划')
        : el('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#settings'; } }, '填入 API Key 后可用'))));

  /* 训练依据 */
  parts.push(card('训练依据（为什么这么练）',
    Plan.EVIDENCE.map(e2 => el('div', { class: 'info-block' },
      el('h3', {}, e2.h),
      el('p', {}, e2.p),
      el('p', { class: 'src' }, '依据：' + e2.src)))));

  /* 参考标准 */
  parts.push(card('中考评分参考（各地不同，以本地文件为准）',
    el('table', { class: 'ref-table' },
      el('thead', {}, el('tr', {}, el('th', {}, '项目'), el('th', {}, '满分线'), el('th', {}, '说明'))),
      el('tbody', {}, Plan.STANDARDS_REF.map(r => el('tr', {},
        el('td', {}, r.event), el('td', {}, r.full), el('td', { class: 'muted' }, r.note))))),
    el('p', { class: 'muted' }, '你的目标可以在「设置 → 三项目目标」里随时调整。')));

  return el('div', { class: 'view' }, ...parts);
}

/* ---------- 记录 ---------- */

function viewLog() {
  const parts = [];
  const streak = Store.streak();
  parts.push(appHeader('训练记录', streak > 0 ? `已连续打卡 ${streak} 天` : '从今天开始，每一笔都算数'));

  /* 三关进度 */
  const cur = Store.current();
  const prof = Store.profile();
  const gates = [
    {
      id: 'run1000', name: '1000 米跑', curText: fmtRunTime(cur.run1000), targetText: fmtRunTime(prof.targets.run1000),
      ratio: cur.run1000 && prof.targets.run1000 ? clamp(prof.targets.run1000 / cur.run1000, 0, 1) : null,
      fmt: fmtRunTime,
    },
    {
      id: 'jump', name: '立定跳远', curText: cur.jump != null ? cur.jump.toFixed(2) + ' 米' : '—', targetText: (prof.targets.jump ?? 0) ? prof.targets.jump.toFixed(2) + ' 米' : '未设置',
      ratio: cur.jump && prof.targets.jump ? clamp(cur.jump / prof.targets.jump, 0, 1) : null,
      fmt: v => v.toFixed(2),
    },
    {
      id: 'pullups', name: '引体向上', curText: cur.pullups != null ? cur.pullups + ' 个' : '—', targetText: (prof.targets.pullups ?? 0) ? prof.targets.pullups + ' 个' : '未设置',
      ratio: cur.pullups != null && prof.targets.pullups ? clamp(cur.pullups / prof.targets.pullups, 0, 1) : null,
      fmt: v => String(Math.round(v)),
    },
  ];
  parts.push(card('三关进度', gates.map(g => {
    const recs = Store.state.records.filter(r => r.event === g.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    const chartBox = el('div', { class: 'chart-box' });
    if (recs.length >= 2) {
      const opts = { fmt: g.fmt, ariaLabel: g.name + '趋势' };
      if (prof.targets[g.id] != null && prof.targets[g.id] > 0) {
        opts.target = { y: prof.targets[g.id], label: `目标 ${g.targetText}` };
      }
      Charts.line(chartBox, recs.map(r => ({ x: fmtDateCn(r.date), y: r.value })), opts);
    } else {
      chartBox.append(el('p', { class: 'chart-empty-note' },
        recs.length === 1 ? '已记录 1 次，再测一次就会出现趋势线。' : '还没有成绩记录。'));
    }
    return el('div', { class: 'gate' },
      el('div', { class: 'gate-head' },
        el('span', { class: 'gate-name' }, g.name),
        el('span', { class: 'gate-nums num' }, el('b', {}, g.curText), el('span', { class: 'muted' }, ` → ${g.targetText}`))),
      g.ratio !== null ? Charts.progressNode(g.ratio, `当前 ${g.curText}`, `目标 ${g.targetText}`) : null,
      chartBox);
  })));

  /* 录入成绩 */
  parts.push(card('录入成绩', recordForm()));

  /* 最近成绩（可删除错录） */
  const allRecs = Store.state.records.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  parts.push(card('最近成绩',
    allRecs.length ? el('div', { class: 'rec-manage' }, allRecs.map(r => {
      const label = { run1000: '1000米 ' + fmtRunTime(r.value), jump: r.value + ' 米', pullups: r.value + ' 个' }[r.event] || '';
      const idx = Store.state.records.indexOf(r);
      return el('div', { class: 'history-row' },
        el('span', { class: 'history-date num' }, r.date),
        el('span', { class: 'history-meta' }, label),
        el('button', {
          class: 'btn btn-ghost sm rec-del', dataset: { idx: String(idx) },
          onclick: e => {
            const b = e.currentTarget;
            if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = '确认删'; setTimeout(() => { b.dataset.arm = ''; b.textContent = '删'; }, 3000); return; }
            const i = Number(b.dataset.idx);
            if (Store.state.records[i]) Store.state.records.splice(i, 1);
            Store.save();
            toast('已删除该条成绩');
            render();
          },
        }, '删'));
    })) : el('p', { class: 'muted' }, '还没有成绩记录。')));

  /* AI 分析历史 */
  const ans = Store.state.analyses.slice(-10).reverse();
  parts.push(card('AI 分析历史',
    ans.length ? ans.map((a, i) => {
      const key = 'an#' + a.date + '#' + i;
      const open = !!ui.expanded[key];
      const body = open ? (() => { const b = el('div', { class: 'ai-body' }); b.innerHTML = mdLite(a.content); return b; })() : null;
      return el('div', { class: 'plan-item' },
        el('div', { class: 'plan-item-row', role: 'button', tabindex: '0',
          onclick: () => { ui.expanded[key] = !open; render(); } },
          el('span', { class: 'check is-dash', 'aria-hidden': 'true' }, '–'),
          el('span', { class: 'plan-item-name' }, (a.kind === 'plan' ? '计划调整 ' : '状态分析 ') + a.date),
          el('span', { class: 'chev', html: ICONS.chevron, 'aria-hidden': 'true' })),
        body);
    }) : el('p', { class: 'muted' }, '还没有 AI 分析。训练后在「今日」页打卡即可一键分析。')));

  /* 打卡历史 */
  const dates = Object.keys(Store.state.checkins).sort().reverse().slice(0, 14);
  parts.push(card('打卡历史',
    dates.length ? el('div', { class: 'history' }, dates.map(d => {
      const c = Store.state.checkins[d];
      const lv = c.workout ? Safety.evaluate({ ...c.workout, waterMl: c.waterMl || null }, [], Store.profile()).level : null;
      return el('div', { class: 'history-row' },
        el('span', { class: 'history-dot ' + (lv ? { ok: 'dot-ok', caution: 'dot-warn', stop: 'dot-stop' }[lv] : 'dot-rest') }),
        el('span', { class: 'history-date num' }, d),
        c.workout ? el('span', { class: 'history-meta' }, `RPE ${c.workout.rpe ?? '—'} · 睡眠 ${c.workout.sleepH ?? '—'}h${c.workout.pain && c.workout.pain.length ? ' · ' + c.workout.pain.join('/') : ''}`) : el('span', { class: 'history-meta muted' }, c.planDone.length ? `完成 ${c.planDone.length} 项` : '未训练'),
        !c.workout && d < todayStr() ? el('button', { class: 'btn btn-ghost sm', onclick: () => openQuiz(d) }, '补卡') : null);
    })) : el('p', { class: 'muted' }, '还没有打卡记录。第一次训练后记得点「训练后打卡」。')));

  return el('div', { class: 'view' }, ...parts);
}

function recordForm() {
  const events = [
    { id: 'run1000', label: '1000 米', ph: "如 4'05\" 或 4:05" },
    { id: 'jump', label: '立定跳远', ph: '米，如 2.35' },
    { id: 'pullups', label: '引体向上', ph: '次数，如 12' },
  ];
  let ev = events[0].id;
  const seg = el('div', { class: 'seg seg-wide' }, events.map(e2 => el('button', {
    class: 'seg-btn' + (e2.id === ev ? ' active' : ''),
    onclick: e => { ev = e2.id; input.placeholder = e2.ph; $$('.seg-btn', seg).forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); },
  }, e2.label)));
  const dateIn = el('input', { type: 'date', value: todayStr(), max: todayStr(), 'aria-label': '成绩日期' });
  const input = el('input', { type: 'text', inputmode: 'decimal', placeholder: events[0].ph, 'aria-label': '成绩' });
  const err = el('p', { class: 'field-err', hidden: true });
  const save = el('button', {
    class: 'btn btn-ghost', onclick: () => {
      err.hidden = true;
      const date = dateIn.value || todayStr();
      if (date > todayStr()) { err.textContent = '成绩日期不能是未来。'; err.hidden = false; return; }
      const raw = input.value.trim();
      let value = null;
      if (ev === 'run1000') { value = parseRunTime(raw); if (!value) { err.textContent = '格式看不懂，请填成 4\'05" 或 4:05 这样的分秒。'; err.hidden = false; return; } }
      if (ev === 'jump') { value = Number(raw); if (!(value > 0.5 && value < 5)) { err.textContent = '请填合理的跳远距离（米），如 2.35。'; err.hidden = false; return; } }
      if (ev === 'pullups') { value = Math.round(Number(raw)); if (!(value >= 0 && value <= 60)) { err.textContent = '请填 0-60 之间的次数。'; err.hidden = false; return; } }
      Store.state.records.push({ date, event: ev, value, note: '' });
      Store.save();
      input.value = '';
      toast('已记录：' + { run1000: fmtRunTime(value) + '（1000米）', jump: value + ' 米', pullups: value + ' 个' }[ev] + (date === todayStr() ? '' : `（${fmtDateCn(date)}）`));
      render();
    },
  }, '保存');
  const wrap = el('div', { class: 'record-form' }, seg,
    el('div', { class: 'record-row' }, dateIn),
    el('div', { class: 'record-row' }, input, save), err,
    el('p', { class: 'muted small' }, '测试不是今天？把日期改成当天再存，趋势和预估才准。'));
  return wrap;
}

/* ---------- 饮食与作息 ---------- */

function viewFuel() {
  const today = todayStr();
  const c = Store.checkin(today);
  const parts = [];
  const prof = Store.profile();
  parts.push(appHeader('饮食与作息', '练是刺激，吃和睡才是生长'));

  /* 今日习惯 */
  const doneN = HABITS.filter(h => c.habits[h.id]).length;
  parts.push(card('今日自律清单',
    el('div', { class: 'habit-grid' }, HABITS.map(h => el('button', {
      class: 'habit' + (c.habits[h.id] ? ' on' : ''),
      'aria-pressed': String(!!c.habits[h.id]),
      onclick: () => { if (c.habits[h.id]) delete c.habits[h.id]; else c.habits[h.id] = 1; Store.save(); render(); },
    }, h.label))),
    el('p', { class: 'muted small' }, `今日 ${doneN}/${HABITS.length} · 全勾满就是完美的一天`)));

  /* 睡眠 */
  const sleepBox = el('div', { class: 'chart-box' });
  const sleepDates = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const cc = Store.state.checkins[d];
    const h = cc && cc.sleepH;
    if (h) sleepDates.push({ x: fmtDateCn(d).replace('月', '/').replace('日', ''), y: h });
  }
  Charts.bars(sleepBox, sleepDates, { emptyText: '连续记录几晚后，这里会出现你的睡眠趋势。', ariaLabel: '近14天睡眠时长' });
  parts.push(card('睡眠', sleepBox,
    el('p', { class: 'muted small' }, '青少年每天需要 8-9 小时睡眠：生长激素在深睡中分泌，骨头和组织修复也一样。手术康复期，睡眠就是你的第二训练。'),
    el('div', { class: 'record-row' },
      el('input', { type: 'number', step: '0.5', min: '0', max: '14', id: 'sleepH-input', placeholder: '昨晚睡了几小时？', 'aria-label': '睡眠小时数' }),
      el('button', {
        class: 'btn btn-ghost', onclick: () => {
          const v = Number($('#sleepH-input').value);
          if (!(v > 0 && v <= 14)) { toast('请填 0-14 之间的小时数', 'bad'); return; }
          c.sleepH = v;
          if (c.workout) c.workout.sleepH = v;
          Store.save(); render(); toast('已记录睡眠 ' + v + ' 小时');
        },
      }, '记录'))));

  /* 饮水 */
  const water = c.waterMl || 0;
  parts.push(card('饮水',
    el('div', { class: 'water-row' },
      el('span', { class: 'num water-num' }, (water / 1000).toFixed(1)), el('span', { class: 'water-unit' }, '升 · 今日'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-ghost sm', onclick: () => { c.waterMl = water + 250; Store.save(); render(); } }, '+250ml'),
        el('button', { class: 'btn btn-ghost sm', onclick: () => { c.waterMl = water + 500; Store.save(); render(); } }, '+500ml'))),
    el('p', { class: 'muted small' }, '目标 1.5-2 升/天。训练前后各 300-500 毫升；少量多次，别等渴了才喝。')));

  /* 营养原则 */
  const nutrition = [
    { h: '三餐结构', p: '早餐必须有蛋白质（鸡蛋/牛奶）和主食；午餐吃饱（这是考试日的体力来源）；晚餐正常吃，不省略。训练日的下午加餐：一根香蕉或一片面包，训练前 30-60 分钟。' },
    { h: '训练后 30-60 分钟', p: '练完尽快吃正餐或加餐：碳水（米饭、馒头、香蕉）＋蛋白质（牛奶、鸡蛋、瘦肉）。这个窗口吃对，第二天酸痛更轻、进步更快。' },
    { h: '蛋白质怎么够', p: '每餐都有优质蛋白就够：鸡蛋、牛奶、瘦肉、鱼、豆制品。一天总量大约 = 体重(kg) × 1.2-1.6 克。蛋白粉不是必需的，好好吃饭优先。' },
    { h: '这些别碰', p: '节食/不吃晚饭（长肌肉需要能量，节食先掉肌肉）、成人补剂和肌酸（未成年不做）、能量饮料（心悸风险）、含糖饮料当水喝。' },
  ];
  if (prof.recovery.legSurgery) {
    nutrition.splice(2, 0, {
      h: '骨头恢复期的营养',
      p: '骨骼愈合需要钙＋维生素 D＋蛋白质：每天 300-500ml 牛奶或等量豆制品、绿叶菜，中午出门晒 15-20 分钟太阳（皮肤合成维 D）。这一点比任何补品都管用。',
    });
  }
  parts.push(card('饮食原则', nutrition.map(n => el('div', { class: 'info-block' }, el('h3', {}, n.h), el('p', {}, n.p)))));

  return el('div', { class: 'view' }, ...parts);
}

/* ---------- 设置 ---------- */

function viewSettings() {
  const p = Store.profile();
  const s = Store.state.settings;
  const parts = [];
  parts.push(appHeader('设置', '数据只保存在这台设备的浏览器里'));

  const numField = (label, val, path, ph, type, range) => field(label,
    el('input', { type: type || 'number', value: val ?? '', placeholder: ph || '', inputmode: 'numeric',
      onchange: e => {
        const raw = e.target.value.trim();
        if (raw === '') {
          if (range && range.required) { e.target.value = val ?? ''; toast('这项不能清空', 'bad'); return; }
          setPath(path, null); Store.save(); saved(e.target); return;
        }
        const v = Number(raw);
        if (range && (!(v >= (range.min ?? -Infinity) && v <= (range.max ?? Infinity)))) {
          e.target.value = val ?? '';
          toast(`请填 ${range.min ?? '∞'} – ${range.max ?? '∞'} 之间的数值`, 'bad');
          return;
        }
        setPath(path, v); Store.save(); saved(e.target);
      } }));

  const runField = field('1000 米目标（如 3\'40"）',
    el('input', { type: 'text', value: fmtRunTime(p.targets.run1000), placeholder: "3'40\"",
      onchange: e => { const v = parseRunTime(e.target.value); if (!v) { toast('格式请写成 3\'40" 或 3:40', 'bad'); e.target.value = fmtRunTime(p.targets.run1000); return; } p.targets.run1000 = v; Store.save(); saved(e.target); } }));

  parts.push(card('身体与考期',
    field('昵称', el('input', { type: 'text', value: p.name, placeholder: '怎么称呼你',
      onchange: e => { p.name = e.target.value.trim(); Store.save(); saved(e.target); } })),
    numField('身高（cm）', p.height, 'profile.height', '如 172', null, { min: 100, max: 250 }),
    numField('体重（kg）', p.weight, 'profile.weight', '如 60', null, { min: 25, max: 150 }),
    field('中考体育日期', el('input', { type: 'date', value: p.examDate,
      onchange: e => { p.examDate = e.target.value; Store.save(); saved(e.target); } })),
    runField,
    numField('立定跳远目标（米）', p.targets.jump, 'profile.targets.jump', '如 2.5', 'number', { min: 1, max: 5, required: true }),
    numField('引体向上目标（次）', p.targets.pullups, 'profile.targets.pullups', '如 16', 'number', { min: 0, max: 60, required: true }),
    el('p', { class: 'muted small' }, '起训基线在「记录」页录入成绩后自动被最新成绩取代。')));

  /* 手术康复 */
  const recBox = card('康复记录',
    el('label', { class: 'switch-row' },
      el('span', {}, el('b', {}, '腿部手术康复中'), el('p', { class: 'muted small' }, '开启后计划进入保守的康复分期，问卷增加手术部位疼痛检查')),
      el('input', { type: 'checkbox', checked: p.recovery.legSurgery || null, onchange: e => { p.recovery.legSurgery = e.target.checked; Store.save(); render(); } })),
    p.recovery.legSurgery ? el('div', { class: 'recovery-more' },
      field('手术日期（大约）', el('input', { type: 'date', value: p.recovery.surgeryDate || '',
        onchange: e => { p.recovery.surgeryDate = e.target.value; Store.save(); saved(e.target); } })),
      el('label', { class: 'switch-row' },
        el('span', {}, el('b', {}, '医生已确认可正常跑跳'), el('p', { class: 'muted small' }, '复诊确认后勾选，计划自动进入正常节奏（跳跃量仍逐周渐进）')),
        el('input', { type: 'checkbox', checked: p.recovery.doctorClear || null, onchange: e => { p.recovery.doctorClear = e.target.checked; Store.save(); render(); } }))) : null);
  parts.push(recBox);

  /* AI 配置 */
  const setPreset = (base, model, name) => {
    s.apiBase = base; s.model = model;
    Store.save();
    toast('已切换到 ' + name + '——确认 Key 是该服务商的');
    render();
  };
  parts.push(card('AI 分析（OpenAI 兼容接口）',
    el('p', { class: 'muted small' }, '服务商预设：'),
    el('div', { class: 'btn-row', style: 'margin-top:0;margin-bottom:12px' },
      el('button', { class: 'btn btn-ghost sm', onclick: () => setPreset('https://api.deepseek.com', 'deepseek-chat', 'DeepSeek') }, 'DeepSeek（浏览器可直连）'),
      el('button', { class: 'btn btn-ghost sm', onclick: () => setPreset('https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash', '智谱') }, '智谱 glm-4-flash（免费）')),
    field('接口地址', el('input', { type: 'url', value: s.apiBase, placeholder: 'https://api.deepseek.com',
      onchange: e => { s.apiBase = e.target.value.trim(); Store.save(); saved(e.target); } })),
    field('模型', el('input', { type: 'text', value: s.model, placeholder: 'deepseek-chat 或 glm-4-flash',
      onchange: e => { s.model = e.target.value.trim(); Store.save(); saved(e.target); } })),
    field('API Key', el('input', { type: 'password', value: s.apiKey, placeholder: 'sk-… 或服务商提供的密钥', autocomplete: 'off',
      onchange: e => { s.apiKey = e.target.value.trim(); Store.save(); saved(e.target); } })),
    el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn btn-ghost', onclick: async e => {
          const b = e.currentTarget;
          if (!s.apiBase || !s.apiKey) { toast('先填好接口地址和 Key', 'bad'); return; }
          b.disabled = true; b.textContent = '测试中…';
          try { await AI.testConnection(); b.textContent = '连接正常 ✓'; toast('连接成功'); }
          catch (err) { b.textContent = '连接失败'; toast(err.message === 'NETWORK' ? '网络不通或被跨域拦截' : '失败：' + err.message, 'bad'); }
          setTimeout(() => { b.disabled = false; b.textContent = '测试连接'; }, 2500);
        },
      }, '测试连接')),
    el('p', { class: 'muted small' }, 'Key 只保存在本机浏览器，请求由你的设备直连服务商。DeepSeek 可浏览器直连、按量计费（本 app 用量下每月约几毛钱）；智谱 glm-4-flash 有免费额度但浏览器跨域被拦，只能用「复制提示词」模式。')));

  /* 数据 */
  parts.push(card('数据',
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn btn-ghost', onclick: () => { doExport(); render(); } }, '导出备份'),
      el('label', { class: 'btn btn-ghost file-btn' }, '导入备份',
        el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: e => {
          const f = e.target.files[0]; if (!f) return;
          f.text().then(t => { Store.importJSON(t); toast('导入成功'); render(); })
            .catch(() => toast('导入失败：文件格式不对', 'bad'));
        } }))),
    el('p', { class: 'muted small' }, '换手机或清浏览器数据前，先导出备份。'),
    el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn btn-danger', onclick: e => {
          if (e.currentTarget.dataset.arm !== '1') { e.currentTarget.dataset.arm = '1'; e.currentTarget.textContent = '再点一次确认清除全部'; setTimeout(() => { e.currentTarget.dataset.arm = ''; e.currentTarget.textContent = '清除全部数据'; }, 4000); return; }
          Store.reset(); ui.weekOffset = 0; toast('已清除'); location.hash = '#today'; render();
        },
      }, '清除全部数据'))));

  /* 关于 */
  parts.push(card('关于',
    el('div', { class: 'info-block' }, el('h3', {}, '薄肌与自律'),
      el('p', {}, '「薄肌从来不是讨好世界的筹码，而是你拿回人生主动权的第一步。」——薄肌不是瘦，是精瘦、有力、可控的身体；自律不是苦熬，是把训练、吃饭、睡觉这三件事日复一日地做对。这个 app 帮你把体育中考的三个项目拆成每天可执行的小事。')),
    el('div', { class: 'info-block' }, el('h3', {}, '安全声明'),
      el('p', {}, '本应用提供一般性训练参考，不构成医疗建议。未成年人训练请在家长或老师知情下进行；出现胸痛、头晕、关节锐痛或手术部位疼痛，立即停止并告知大人，必要时就医。训练前请确认手术医生已允许恢复运动。')),
    el('p', { class: 'muted small' }, '薄肌与自律 v1.3 · 本地优先 PWA · 无需联网即可使用')));
  return el('div', { class: 'view' }, ...parts);
}

function field(labelText, input) {
  /* label 包裹控件，形成隐式关联，输入框自动获得可访问名称 */
  return el('div', { class: 'field' }, el('label', {}, labelText + ' ', input));
}

/* 导出备份（今日页提醒与设置页共用） */
function doExport() {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `薄肌与自律-备份-${todayStr()}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
  Store.state.ui.lastBackupAt = todayStr();
  Store.save();
  toast('已导出备份——建议存到云盘或备忘录');
}
function saved(input) {
  input.classList.add('just-saved');
  setTimeout(() => input.classList.remove('just-saved'), 1200);
  toast('已保存');
}
function setPath(path, value) {
  const keys = path.split('.');
  let obj = Store.state;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = value;
}

/* ---------- 训练后问卷（底部弹层） ---------- */

function openQuiz(date) {
  const d = date || todayStr();
  const isToday = d === todayStr();
  const c = Store.checkin(d);
  const w0 = c.workout || { rpe: 6, sleepH: c.sleepH || null, restingHr: null, soreness: 'none', pain: [], redflags: [], note: '' };

  const rpeVal = el('span', { class: 'num accent quiz-rpe-val' }, String(w0.rpe ?? 6));
  const rpe = el('input', { type: 'range', min: '0', max: '10', step: '0.5', value: w0.rpe ?? 6, 'aria-label': '主观疲劳程度' });
  rpe.addEventListener('input', () => { rpeVal.textContent = Number(rpe.value).toFixed(1); });

  const sleepIn = el('input', { type: 'number', step: '0.5', min: '0', max: '14', value: w0.sleepH ?? '', placeholder: '如 8', 'aria-label': '昨晚睡眠小时' });
  const hrIn = el('input', { type: 'number', min: '30', max: '150', value: w0.restingHr ?? '', placeholder: '选填', 'aria-label': '静息心率' });

  let soreness = w0.soreness || 'none';
  const soreSeg = el('div', { class: 'seg seg-wide' }, [['none', '没有'], ['mild', '轻微'], ['heavy', '明显']].map(([v, t]) => el('button', {
    class: 'seg-btn' + (v === soreness ? ' active' : ''),
    onclick: e => { soreness = v; $$('.seg-btn', soreSeg).forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); },
  }, t)));

  const chipGroup = (options, selected, danger) => el('div', { class: 'chip-group' }, options.map(o => {
    let on = selected.includes(o);
    const b = el('button', { type: 'button', class: 'chip-t' + (on ? ' on' : '') + (danger ? ' danger' : ''), 'aria-pressed': String(on) }, o);
    b.addEventListener('click', () => {
      on = !on;
      if (on) selected.push(o); else selected.splice(selected.indexOf(o), 1);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    return b;
  }));
  const pain = (w0.pain || []).slice();
  const redflags = (w0.redflags || []).slice();
  const note = el('textarea', { rows: '2', placeholder: '想补充的任何情况（选填）', 'aria-label': '备注' });
  note.value = w0.note || '';

  const sheet = el('div', { class: 'sheet-mask', onclick: e => { if (e.target === sheet) close(); } },
    el('div', { class: 'sheet', role: 'dialog', 'aria-label': '训练后状态问卷' },
      el('div', { class: 'sheet-grip' }),
      el('h2', {}, isToday ? '训练后状态' : `补打卡 · ${fmtDateCn(d)}`),
      el('p', { class: 'muted small' }, isToday ? '如实填，这是计划调整和安全保护的依据。' : '回忆一下那天的状态，尽量如实填写。'),
      el('div', { class: 'quiz-field' }, el('label', {}, '这次训练的主观疲劳（0 轻松 – 10 极限）', rpeVal), rpe),
      el('div', { class: 'quiz-field' }, el('label', {}, '昨晚睡眠（小时）'), sleepIn),
      el('div', { class: 'quiz-field' }, el('label', {}, '今早静息心率（次/分）'), hrIn),
      el('div', { class: 'quiz-field' }, el('label', {}, '肌肉酸痛程度'), soreSeg),
      el('div', { class: 'quiz-field' }, el('label', {}, '身体哪里疼？（没有就不选）'), chipGroup(Safety.PAIN_SITES, pain, false)),
      el('div', { class: 'quiz-field' }, el('label', { class: 'warn-label' }, '有没有这些症状？（红线，有必选）'), chipGroup(Safety.RED_FLAGS, redflags, true)),
      el('div', { class: 'quiz-field' }, el('label', {}, '备注'), note),
      el('button', {
        class: 'btn btn-primary', onclick: () => {
          c.workout = {
            rpe: Number(rpe.value), sleepH: sleepIn.value === '' ? null : Number(sleepIn.value),
            restingHr: hrIn.value === '' ? null : Number(hrIn.value),
            soreness, pain, redflags, note: note.value.trim(),
          };
          c.sleepH = c.workout.sleepH ?? c.sleepH;
          Store.save();
          close();
          render();
          const lv = Safety.evaluate({ ...c.workout, waterMl: c.waterMl || null }, [], Store.profile()).level;
          if (isToday) {
            toast(lv === 'stop' ? '有需要重视的信号，看状态卡' : '打卡完成', lv === 'stop' ? 'bad' : undefined);
            const n = document.querySelector('.notice');
            if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            toast(`已补 ${fmtDateCn(d)} 的打卡`, lv === 'stop' ? 'bad' : undefined);
          }
        },
      }, isToday ? '保存并评估' : '保存补卡')));

  function close() { sheet.remove(); }
  document.body.append(sheet);
}

/* ---------- 首次引导 ---------- */

function maybeOnboarding() {
  if (Store.state.onboarded) return null;
  const p = Store.profile();

  const nameIn = el('input', { type: 'text', placeholder: '选填' });
  const hIn = el('input', { type: 'number', placeholder: '如 172' });
  const wIn = el('input', { type: 'number', placeholder: '如 60' });
  const examIn = el('input', { type: 'date' });
  let days = 5;
  const daysSeg = el('div', { class: 'seg seg-wide' }, [3, 4, 5, 6].map(n => el('button', {
    class: 'seg-btn' + (n === 5 ? ' active' : ''), onclick: e => { days = n; $$('.seg-btn', daysSeg).forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); },
  }, n + ' 天')));
  const runIn = el('input', { type: 'text', placeholder: "术前约 4'00\"" });
  const jumpIn = el('input', { type: 'text', placeholder: '术后未知可留空，首次测试再录' });
  const pullIn = el('input', { type: 'number', placeholder: '如 15' });
  const recChk = el('input', { type: 'checkbox', checked: true });
  const recDate = el('input', { type: 'date' });
  const err = el('p', { class: 'field-err', hidden: true });

  return el('div', { class: 'onboard' },
    el('div', { class: 'onboard-inner' },
      el('p', { class: 'onboard-quote' }, '「薄肌从来不是讨好世界的筹码，而是你拿回人生主动权的第一步。」'),
      el('h1', {}, '薄肌与自律'),
      el('p', { class: 'muted' }, '体育中考三项（1000 米 · 立定跳远 · 引体向上）的科学备战：按你的康复情况生成课表，训练后打卡，AI 帮你盯状态。'),
      field('中考体育日期（必填）', examIn),
      field('每周自主训练天数（工作日短课，周末主课）', daysSeg),
      el('div', { class: 'field-row' }, numCell('身高 cm', hIn), numCell('体重 kg', wIn)),
      field('昵称', nameIn),
      el('h3', { class: 'onboard-h' }, '三项现状（起训基线，之后以实测为准）'),
      field('1000 米', runIn),
      field('立定跳远', jumpIn),
      field('引体向上', pullIn),
      el('h3', { class: 'onboard-h' }, '手术康复'),
      el('label', { class: 'switch-row' },
        el('span', {}, el('b', {}, '腿部手术康复中'), el('p', { class: 'muted small' }, '开启后前几周不安排跳跃，逐周渐进')),
        recChk),
      field('手术日期（大约）', recDate),
      el('p', { class: 'muted small' }, '目标默认按满分线设置（3\'40" · 2.50 米 · 16 个），之后可在设置里改。成绩填不准没关系，第一次测试后再校准。'),
      err,
      el('button', {
        class: 'btn btn-primary btn-block', onclick: () => {
          if (!examIn.value) { err.textContent = '请填中考体育日期——它是整个计划的锚点。'; err.hidden = false; return; }
          p.name = nameIn.value.trim();
          p.height = hIn.value ? Number(hIn.value) : null;
          p.weight = wIn.value ? Number(wIn.value) : null;
          p.examDate = examIn.value;
          p.daysPerWeek = days;
          const rv = parseRunTime(runIn.value); if (rv) p.baseline.run1000 = rv;
          const jv = Number(jumpIn.value); if (jv > 0.5 && jv < 5) p.baseline.jump = jv;
          const pv = Number(pullIn.value); if (pv >= 0 && pv <= 60) p.baseline.pullups = pv;
          p.recovery.legSurgery = recChk.checked;
          p.recovery.surgeryDate = recDate.value || '';
          Store.state.startDate = todayStr();
          Store.state.onboarded = true;
          Store.save();
          toast('开始吧 · 第一周是打底子');
          render();
        },
      }, '开始训练')));
}
function numCell(labelText, input) {
  return el('div', { class: 'field' }, el('label', {}, labelText + ' ', input));
}

/* ---------- 路由与渲染 ---------- */

function render(toTop) {
  const main = $('#view');
  main.innerHTML = '';
  const ob = maybeOnboarding();
  if (ob) { main.append(ob); setNavActive(null); return; }
  const views = { today: viewToday, plan: viewPlan, log: viewLog, fuel: viewFuel, settings: viewSettings };
  const r = ui.route;
  main.append((views[r] || viewToday)());
  setNavActive(r);
  /* 只在切换页面时回到顶部；勾选、展开、打卡等局部操作保持滚动位置 */
  if (toTop) window.scrollTo(0, 0);
}

function setNavActive(id) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === id));
}

/* 支持 ?key=APIKEY[&base=...][&model=...] 一键配置：保存后立即从地址栏清除，避免密钥留在历史里 */
function captureKeyFromUrl() {
  const q = new URLSearchParams(location.search);
  const key = q.get('key');
  if (!key) return;
  const s = Store.state.settings;
  s.apiKey = key.trim();
  const base = q.get('base');
  const model = q.get('model');
  if (base) s.apiBase = base.trim();
  if (model) s.model = model.trim();
  Store.save();
  try {
    history.replaceState(null, '', location.pathname + location.hash);
  } catch (_) { /* 旧浏览器忽略 */ }
  setTimeout(() => toast('AI 已配置完成 ✓'), 600);
}

function boot() {
  captureKeyFromUrl();
  const nav = el('nav', { class: 'bottom-nav', 'aria-label': '主导航' },
    NAV.map(n => el('button', {
      class: 'nav-btn', dataset: { route: n.id },
      onclick: () => { ui.route = n.id; ui.weekOffset = 0; location.hash = '#' + n.id; render(true); },
    }, el('span', { html: ICONS[n.id], 'aria-hidden': 'true' }), el('span', { class: 'nav-label' }, n.label))));
  document.body.append(nav);

  const initial = (location.hash || '#today').slice(1);
  if (NAV.some(n => n.id === initial)) ui.route = initial;
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (NAV.some(n => n.id === h)) { ui.route = h; render(true); }
  });
  render(true);
}

document.addEventListener('DOMContentLoaded', boot);
