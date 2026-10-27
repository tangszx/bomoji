/* 薄肌与自律 · 激励系统
 *
 * 心理学依据：
 *  - 正强化（操作性条件反射）：行为后即时给予奖励，行为更可能重复；
 *  - 成长型思维（Dweck）：夸努力与过程，不夸天赋——学生语境尤其重要；
 *  - 目标梯度效应：离目标越近动力越强——等级进度条显示"还差多少"；
 *  - 自我决定理论：胜任感+自主感驱动内在动机，不靠羞辱和焦虑（断签不惩罚）；
 *  - 可变奖励：同样的完成，鼓励语轮换出现，保持新鲜感；
 *  - 习惯养成（Lally 2010）：平均约 66 天自动化——连续类徽章按 7/15/30/100 天设阶。
 *
 * 诚实原则：所有 XP 与徽章都从真实日志推导（训练项勾选、问卷、习惯、成绩），
 * 没有"自评完成"按钮，奖励不可伪造也不必伪造。
 */
'use strict';

const Rewards = (() => {

  /* ---------- 自律值（XP） ---------- */

  const XP_RULE = {
    planItem: 10,    // 完成一个训练项
    quiz: 15,        // 训练后问卷
    habit: 5,        // 每个习惯
    water2l: 5,      // 单日饮水达 2L
    record: 20,      // 录入一次成绩
    pb: 30,          // 刷新个人最好成绩
  };

  const LEVELS = [
    { lv: 1, name: '初醒', xp: 0, note: '一切都从打开 app 这一刻开始' },
    { lv: 2, name: '萌芽', xp: 100, note: '身体开始记住训练的节奏' },
    { lv: 3, name: '起势', xp: 240, note: '习惯的雏形出现了' },
    { lv: 4, name: '薄肌初现', xp: 450, note: '镜子里的线条不会说谎' },
    { lv: 5, name: '线条成形', xp: 750, note: '训练日已经是默认选项' },
    { lv: 6, name: '自律常态', xp: 1150, note: '不再需要意志力来说服自己' },
    { lv: 7, name: '主动权在我', xp: 1650, note: '薄肌从来不是筹码，是主动权' },
    { lv: 8, name: '薄肌大成', xp: 2300, note: '精瘦、有力、可控' },
    { lv: 9, name: '考场如常', xp: 3000, note: '考试只是又一次正常发挥' },
  ];

  function computeXP(state) {
    let xp = 0;
    for (const c of Object.values(state.checkins)) {
      if (c.planDone) xp += c.planDone.length * XP_RULE.planItem;
      if (c.workout) xp += XP_RULE.quiz;
      if (c.habits) xp += Object.keys(c.habits).length * XP_RULE.habit;
      if (c.waterMl >= 2000) xp += XP_RULE.water2l;
    }
    xp += state.records.length * XP_RULE.record;
    xp += countPBs(state.records).total * XP_RULE.pb;
    return xp;
  }

  function levelFor(xp) {
    let cur = LEVELS[0];
    for (const l of LEVELS) if (xp >= l.xp) cur = l;
    const next = LEVELS.find(l => l.xp > xp) || null;
    const span = next ? next.xp - cur.xp : 1;
    const into = next ? xp - cur.xp : 1;
    return { ...cur, next, ratio: next ? clamp(into / span, 0, 1) : 1 };
  }

  /* ---------- 个人最好成绩（PB） ---------- */

  function pbStats(records) {
    const map = countPBs(records);
    return map.byEvent;
  }
  function countPBs(records) {
    const sorted = [...records].sort((a, b) => (a.date < b.date ? -1 : 1));
    const best = {};
    const byEvent = { run1000: 0, jump: 0, pullups: 0 };
    let total = 0;
    for (const r of sorted) {
      if (!(r.event in best)) { best[r.event] = r.value; continue; }
      const better = r.event === 'run1000' ? r.value < best[r.event] : r.value > best[r.event];
      if (better) {
        best[r.event] = r.value;
        if (byEvent[r.event] !== undefined) byEvent[r.event]++;
        total++;
      }
    }
    return { total, byEvent, best };
  }
  /* 保存新成绩时判断是否 PB（与之前最好比） */
  function isPB(records, ev, value) {
    const prev = records.filter(r => r.event === ev);
    if (!prev.length) return { pb: false, first: true, best: null };
    const best = ev === 'run1000'
      ? Math.min(...prev.map(r => r.value))
      : Math.max(...prev.map(r => r.value));
    const pb = ev === 'run1000' ? value < best : value > best;
    return { pb, first: false, best };
  }

  /* ---------- 历史最长连续 ---------- */

  function maxStreak(state) {
    const days = Object.keys(state.checkins)
      .filter(d => {
        const c = state.checkins[d];
        return (c.planDone && c.planDone.length) || c.workout || (c.habits && Object.keys(c.habits).length) || c.waterMl;
      })
      .sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) {
      run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }

  function lastActiveDate(state) {
    const days = Object.keys(state.checkins)
      .filter(d => {
        const c = state.checkins[d];
        return (c.planDone && c.planDone.length) || c.workout || (c.habits && Object.keys(c.habits).length) || c.waterMl || c.sleepH;
      })
      .sort();
    return days.length ? days[days.length - 1] : null;
  }

  /* ---------- 徽章 ---------- */

  const BADGES = [
    { id: 'first_step', name: '第一步', desc: '完成第一个训练项', test: s => Object.values(s.checkins).some(c => c.planDone && c.planDone.length) },
    { id: 'first_quiz', name: '身体的声音', desc: '第一次训练后问卷', test: s => Object.values(s.checkins).some(c => c.workout) },
    { id: 'first_fullday', name: '完整的一天', desc: '第一次完成当日全部训练', test: s => Object.values(s.checkins).some(c => c.allDone) },
    { id: 'streak7', name: '七日之约', desc: '连续 7 天有记录', test: s => maxStreak(s) >= 7 },
    { id: 'streak15', name: '半月不辍', desc: '连续 15 天有记录', test: s => maxStreak(s) >= 15 },
    { id: 'streak30', name: '三十天火种', desc: '连续 30 天有记录', test: s => maxStreak(s) >= 30 },
    { id: 'streak100', name: '百日筑基', desc: '连续 100 天有记录', test: s => maxStreak(s) >= 100 },
    { id: 'data5', name: '数据控', desc: '录入 5 次成绩', test: s => s.records.length >= 5 },
    { id: 'pb_run', name: '新纪录 · 千米', desc: '1000 米刷新个人最好', test: s => pbStats(s.records).run1000 >= 1 },
    { id: 'pb_jump', name: '新纪录 · 跳远', desc: '立定跳远刷新个人最好', test: s => pbStats(s.records).jump >= 1 },
    { id: 'pb_pull', name: '新纪录 · 引体', desc: '引体向上刷新个人最好', test: s => pbStats(s.records).pullups >= 1 },
    { id: 'back_jump', name: '重返跳跃', desc: '医生确认后解锁跑跳（康复里程碑）', test: s => s.profile.recovery.legSurgery && s.profile.recovery.doctorClear },
    { id: 'sleep7', name: '睡饱一周', desc: '累计 7 晚睡眠 ≥ 8 小时', test: s => Object.values(s.checkins).filter(c => (c.sleepH || (c.workout && c.workout.sleepH) || 0) >= 8).length >= 7 },
    { id: 'water2l', name: '水分银行', desc: '单日饮水达到 2 升', test: s => Object.values(s.checkins).some(c => c.waterMl >= 2000) },
    { id: 'items30', name: '三十件事', desc: '累计完成 30 个训练项', test: s => Object.values(s.checkins).reduce((n, c) => n + ((c.planDone && c.planDone.length) || 0), 0) >= 30 },
    { id: 'target_hit', name: '满分冲刺', desc: '任一项目达到目标线', test: s => {
        const cur = { run1000: s.profile.baseline.run1000, jump: s.profile.baseline.jump, pullups: s.profile.baseline.pullups };
        for (const r of [...s.records].sort((a, b) => (a.date < b.date ? -1 : 1))) cur[r.event] = r.value;
        const t = s.profile.targets;
        return (cur.run1000 && cur.run1000 <= t.run1000) || (cur.jump && cur.jump >= t.jump) || (cur.pullups != null && cur.pullups >= t.pullups);
      } },
  ];

  /* 检查新获得的徽章（写入 badges 记录，返回新增列表） */
  function check() {
    const state = Store.state;
    if (!state.badges) state.badges = {};
    const fresh = [];
    for (const b of BADGES) {
      if (state.badges[b.id]) continue;
      let ok = false;
      try { ok = b.test(state); } catch (_) { ok = false; }
      if (ok) {
        state.badges[b.id] = todayStr();
        fresh.push(b);
      }
    }
    return fresh;
  }

  /* ---------- 鼓励文案（轮换 = 可变奖励） ---------- */

  const PRAISE_DAY = [
    '今天的训练全部完成——你兑现了对自己的承诺。',
    '全部拿下。进步就藏在这种"平常"的日子里。',
    '又一天说到做到。自律不是苦熬，是攒确定性。',
    '完成即胜利。今天的你已经比昨天强了一点。',
    '清单清零的感觉不错吧？明天见。',
    '身体在悄悄适应，你负责出现，它负责生长。',
    '这就是拿回主动权的样子：一天一天,自己说了算。',
    '训练结束,生长开始——今晚好好睡,肌肉在夜里长。',
    '别小看今天这份坚持,考场上每一秒都从这里来。',
    '稳定大于强度。你今天做的正是最难得的事。',
    '薄肌不是练出来的某一天,是每天都这样的累积。',
    '执行力满分。休息也好好休,明天继续。',
  ];
  const PRAISE_QUIZ_OK = [
    '打卡完成。如实记录本身就是自律。',
    '身体信号正常,这是训练对身体"讲道理"的结果。',
    '恢复良好——你给身体的刺激它接住了。',
  ];
  const PRAISE_QUIZ_CAUTION = [
    '打卡完成。降一点量不是退步,是聪明。',
    '记下了。听话的身体才能陪你走到考场。',
    '好信号坏信号都是信息,你在学会读自己。',
  ];
  const PRAISE_QUIZ_STOP = [
    '已记录。停下需要勇气,这是最成熟的训练决策。',
    '已记录。先恢复,成绩永远等得起健康。',
  ];
  const PRAISE_RECORD = [
    '已记录。数据不会说谎,它会带你去想去的地方。',
    '已记录。每一次实测都在校准你的航向。',
    '已记录。考前的确定性,就是这样一格格攒的。',
  ];

  function pick(pool, seedStr) {
    let h = 0;
    const s = String(seedStr || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }

  return { XP_RULE, LEVELS, computeXP, levelFor, check, BADGES, isPB, maxStreak, lastActiveDate, PRAISE_DAY, PRAISE_QUIZ_OK, PRAISE_QUIZ_CAUTION, PRAISE_QUIZ_STOP, PRAISE_RECORD, pick };
})();
