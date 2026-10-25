/* 薄肌与自律 · 本地数据层（localStorage，数据只存在设备上） */
'use strict';

const STORE_KEY = 'bjzl.v1';

const HABITS = [
  { id: 'sleep9', label: '睡眠 8 小时+' },
  { id: 'water', label: '饮水 2L 左右' },
  { id: 'protein', label: '三餐有优质蛋白' },
  { id: 'veg', label: '蔬果吃够了' },
  { id: 'nosugar', label: '没喝含糖饮料' },
  { id: 'stretch', label: '睡前拉伸放松' },
];

function defaultState() {
  return {
    onboarded: false,
    startDate: '',         // 开始训练的日期（周期计算的锚点）
    profile: {
      name: '',
      sex: 'male',
      grade: '初三',
      height: null,          // cm
      weight: null,          // kg
      examDate: '',          // 中考体育日期 YYYY-MM-DD
      daysPerWeek: 5,        // 每周训练天数 3-6
      baseline: { run1000: null, jump: null, pullups: null },   // 起训基线
      targets: { run1000: 220, jump: 2.5, pullups: 16 },        // 目标：秒 / 米 / 次（默认冲满分）
      recovery: { legSurgery: false, surgeryDate: '', doctorClear: false },  // 腿部手术康复
    },
    checkins: {},             // date -> { planDone:[itemId], habits:{id:1}, workout:{...}, meals:{...} }
    records: [],              // { date, event:'run1000'|'jump'|'pullups', value, note }
    analyses: [],             // { date, kind:'status'|'plan', summary, content }
    aiPlan: null,             // AI 调整的下周计划 { forWeekStart, week:[{day,focus,items:[...] }], reason }
    settings: {
      apiBase: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
      model: 'glm-4-flash',
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const base = defaultState();
    return deepMerge(base, saved);
  } catch (err) {
    console.warn('数据读取失败，使用全新数据', err);
    return defaultState();
  }
}

function deepMerge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(saved)) {
    if (v === null || v === undefined) continue;
    const b = base ? base[k] : undefined;
    out[k] = (b && typeof b === 'object' && !Array.isArray(b) && typeof v === 'object' && !Array.isArray(v))
      ? deepMerge(b, v)
      : v;
  }
  return out;
}

const Store = {
  state: loadState(),

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch (err) {
      toast('保存失败：本地存储空间不足', 'bad');
      console.error(err);
    }
  },

  reset() {
    localStorage.removeItem(STORE_KEY);
    this.state = defaultState();
  },

  /* ---- 读写快捷方式 ---- */
  profile() { return this.state.profile; },

  checkin(date) {
    if (!this.state.checkins[date]) this.state.checkins[date] = { planDone: [], habits: {}, workout: null, meals: {} };
    return this.state.checkins[date];
  },

  latestRecord(event) {
    const list = this.state.records.filter(r => r.event === event).sort((a, b) => (a.date < b.date ? 1 : -1));
    return list[0] || null;
  },

  /* 三项目当前水平：优先用最近一次实测成绩，否则用训练开始时的基线 */
  current() {
    const p = this.profile();
    const run = this.latestRecord('run1000')?.value ?? p.baseline.run1000;
    const jump = this.latestRecord('jump')?.value ?? p.baseline.jump;
    const pull = this.latestRecord('pullups')?.value ?? p.baseline.pullups;
    return { run1000: run, jump, pullups: pull };
  },

  /* 连续打卡天数（有任意训练或习惯记录就算） */
  streak() {
    let n = 0;
    let d = todayStr();
    // 今天还没打卡不算断签，从昨天往前数
    const has = (s) => {
      const c = this.state.checkins[s];
      return c && ((c.planDone && c.planDone.length) || (c.habits && Object.keys(c.habits).length) || c.workout);
    };
    if (!has(d)) d = addDays(d, -1);
    while (has(d)) { n++; d = addDays(d, -1); }
    return n;
  },

  exportJSON() {
    return JSON.stringify({ app: '薄肌与自律', version: 1, exportedAt: new Date().toISOString(), data: this.state }, null, 2);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !data.profile) throw new Error('文件格式不正确');
    this.state = deepMerge(defaultState(), data);
    this.save();
  },
};
