/* 薄肌与自律 · AI 分析模块
 *
 * 调用 OpenAI 兼容的 chat/completions 接口（默认智谱 GLM）。
 * API Key 只保存在本机 localStorage，随请求直发服务商，不经过任何中间服务器。
 * 若浏览器直连被跨域策略拦截，自动降级为「复制提示词」方案。
 */
'use strict';

const AI = (() => {

  const SYSTEM_STATUS = [
    '你是一名持有执照的运动科学教练兼运动安全顾问，服务对象是一名正在备战体育中考的初中生（未成年人）。',
    '你的任务是阅读用户提交的训练后状态问卷与近期训练数据，给出状态解读和接下来 1-3 天的建议。',
    '硬性规则：',
    '1. 出现头晕、胸闷/胸痛、心悸、眼前发黑、呼吸异常等症状时，必须首先明确建议：立即停止训练、告知家长或老师、必要时就医。绝不允许建议「再坚持一下」。',
    '2. 你不是医生，不做诊断；持续疼痛（超过3天）、疑似伤病一律建议就医检查。',
    '3. 对未成年人：不建议任何节食、减重药、运动补剂（蛋白粉除外且需谨慎）；不建议力竭训练和负重训练；强调睡眠 8-9 小时与三餐营养。',
    '4. 建议必须具体可执行（如「明天把间歇从 6 组减到 4 组」），避免空话。',
    '5. 用中文回答，语气平静专业、不贩卖焦虑。结构：状态解读 → 风险提示 → 未来 1-3 天安排建议 → 一句鼓励。总长不超过 350 字。',
  ].join('\n');

  const SYSTEM_PLAN = [
    '你是一名体育中考训练计划设计师。用户会给你：三个项目（1000米跑、立定跳远、引体向上）的目标与近期成绩、每周训练天数、以及最近两周的训练打卡记录。',
    '请输出下周的调整计划。硬性规则：未成年人不做负重与力竭训练；每周至少 1 个完整休息日；出现疲劳/疼痛信号时先降量；考前 10 天内必须减量。',
    '严格只输出 JSON（不要 markdown 代码块包裹以外的任何文字），格式：',
    '{"reason":"一句话说明为什么这样调整","week":[{"day":"周一","focus":"引体","items":[{"name":"动作名","detail":"组数次数与要点","min":40}]}]}',
    'week 必须恰好 7 个元素（周一到周日），休息日 items 里放一个 {name:"休息日",detail:"...",min:0}。detail 用中文，具体到组数、次数、配速。',
  ].join('\n');

  function configured() {
    const s = Store.state.settings;
    return !!(s.apiBase && s.apiKey && s.model);
  }

  async function chat(system, user, maxTokens) {
    const { apiBase, apiKey, model } = Store.state.settings;
    const url = apiBase.replace(/\/+$/, '') + '/chat/completions';
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: maxTokens || 900,
        }),
      });
    } catch (err) {
      throw new Error('NETWORK');
    }
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const j = await resp.json();
        if (j.error && j.error.message) msg = j.error.message;
      } catch (_) { /* 忽略解析失败 */ }
      throw new Error(msg);
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('服务商返回了空内容');
    return content.trim();
  }

  /* ---- 组装状态分析的用户消息 ---- */

  function statusContext(latestCheckin) {
    const p = Store.profile();
    const cur = Store.current();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(todayStr(), -i);
      const c = Store.state.checkins[d];
      if (!c) continue;
      const bits = [d];
      if (c.planDone && c.planDone.length) bits.push(`完成训练项 ${c.planDone.length} 个`);
      if (c.workout) {
        const w = c.workout;
        bits.push(`RPE${w.rpe ?? '-'} 睡眠${w.sleepH ?? '-'}h ${w.soreness ? '酸痛:' + w.soreness : ''}${w.pain && w.pain.length ? ' 疼痛:' + w.pain.join('/') : ''}${w.restingHr ? ' 静息心率' + w.restingHr : ''}`);
      }
      if (c.habits && Object.keys(c.habits).length) bits.push(`习惯打卡 ${Object.keys(c.habits).length}/6`);
      days.push(bits.join(' | '));
    }
    const w = latestCheckin && latestCheckin.workout;
    const rec = p.recovery;
    const recLine = rec && rec.legSurgery
      ? `重要：腿部做过骨肿瘤切除手术${rec.surgeryDate ? '（约 ' + rec.surgeryDate + '）' : ''}，术后恢复中${rec.doctorClear ? '，医生已确认可正常跑跳' : '，尚未获得医生跑跳确认，计划正按保守的康复分期渐进'}。涉及手术腿的任何深部疼痛都应建议停训并复诊。`
      : '';
    const q = w ? [
      '—— 最新训练后问卷 ——',
      `日期：${latestCheckin.date || todayStr()}`,
      `主观疲劳 RPE：${w.rpe}/10`,
      `昨晚睡眠：${w.sleepH ?? '未填'} 小时`,
      `静息心率：${w.restingHr || '未填'}`,
      `肌肉酸痛：${w.soreness || '未填'}${w.pain && w.pain.length ? '（疼痛部位：' + w.pain.join('、') + '）' : ''}`,
      `红旗症状：${w.redflags && w.redflags.length ? w.redflags.join('、') : '无'}`,
      `今日饮水：约 ${w.waterMl || '未填'} 毫升`,
      w.note ? `补充说明：${w.note}` : '',
    ].filter(Boolean).join('\n') : '（无问卷）';

    return [
      `学生信息：${p.grade || '初中'}男生，${p.height || '?'}cm / ${p.weight || '?'}kg。`,
      recLine,
      `中考体育日期：${p.examDate || '未设置'}。`,
      `三个项目 —— 1000米：当前 ${fmtRunTime(cur.run1000)} / 目标 ${fmtRunTime(p.targets.run1000)}；立定跳远：当前 ${cur.jump ?? '?'} 米 / 目标 ${p.targets.jump} 米；引体向上：当前 ${cur.pullups ?? '?'} 个 / 目标 ${p.targets.pullups} 个。`,
      `每周训练 ${p.daysPerWeek} 天。`,
      '',
      '—— 近 14 天打卡 ——',
      days.length ? days.join('\n') : '（暂无记录）',
      '',
      q,
    ].join('\n');
  }

  async function analyzeStatus(latestCheckin) {
    return chat(SYSTEM_STATUS, statusContext(latestCheckin), 700);
  }

  /* ---- 计划调整 ---- */

  function planContext() {
    const p = Store.profile();
    const cur = Store.current();
    const rec = p.recovery;
    const recLine = rec && rec.legSurgery
      ? `重要：腿部骨肿瘤切除手术后恢复中（${rec.surgeryDate || '日期未填'}），${rec.doctorClear ? '医生已确认可正常跑跳' : '未获医生确认，跳跃量必须保守渐进'}。`
      : '';
    const recs = Store.state.records.slice(-12).map(r => `${r.date} ${r.event === 'run1000' ? '1000米 ' + fmtRunTime(r.value) : r.event === 'jump' ? '跳远 ' + r.value + '米' : '引体 ' + r.value + '个'}`);
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(todayStr(), -i);
      const c = Store.state.checkins[d];
      if (c && c.workout) days.push(`${d} RPE${c.workout.rpe ?? '-'} 睡眠${c.workout.sleepH ?? '-'}h${c.workout.pain && c.workout.pain.length ? ' 疼痛:' + c.workout.pain.join('/') : ''}`);
    }
    return [
      `学生：${p.grade || '初中'}男生，中考体育日期 ${p.examDate || '未设置'}，每周放学后可短训、周末可长训。`,
      recLine,
      `1000米 当前 ${fmtRunTime(cur.run1000)} / 目标 ${fmtRunTime(p.targets.run1000)}；立定跳远 当前 ${cur.jump ?? '?'} 米 / 目标 ${p.targets.jump} 米；引体向上 当前 ${cur.pullups ?? '?'} 个 / 目标 ${p.targets.pullups} 个。`,
      '',
      '近期成绩记录：',
      recs.length ? recs.join('\n') : '（暂无）',
      '',
      '近期疲劳情况（RPE 0-10，睡眠小时）：',
      days.length ? days.join('\n') : '（暂无）',
      '',
      '请基于以上数据设计下周的调整计划，严格只输出约定格式的 JSON。',
    ].join('\n');
  }

  function extractJSON(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('RESPONSE_FORMAT');
    return JSON.parse(m[0]);
  }

  function validateWeek(obj) {
    if (!obj || !Array.isArray(obj.week) || obj.week.length !== 7) throw new Error('RESPONSE_FORMAT');
    const week = obj.week.map(d => ({
      day: String(d.day || ''),
      focus: String(d.focus || ''),
      items: Array.isArray(d.items) ? d.items.map(it => ({
        name: String(it.name || '').slice(0, 60),
        detail: String(it.detail || '').slice(0, 1200),
        min: Number(it.min) || 0,
      })).filter(it => it.name) : [],
    }));
    if (week.some(d => !d.items.length)) throw new Error('RESPONSE_FORMAT');
    return { reason: String(obj.reason || '').slice(0, 300), week };
  }

  async function adjustPlan() {
    const raw = await chat(SYSTEM_PLAN, planContext(), 1600);
    return { ...validateWeek(extractJSON(raw)), forWeekStart: weekStart(addDays(todayStr(), 7)) };
  }

  /* ---- 连接测试 ---- */
  async function testConnection() {
    const reply = await chat('你是一个连通性测试程序。', '请只回复两个字：正常', 20);
    return reply.slice(0, 20);
  }

  return { configured, analyzeStatus, adjustPlan, testConnection, statusContext, planContext, SYSTEM_PLAN };
})();
