/* 薄肌与自律 · 安全规则引擎
 *
 * 训练后状态问卷的本地即时判断，不联网也能给出分级建议：
 *   ok      可以按计划继续
 *   caution 降强度 / 加恢复（琥珀色）
 *   stop    停止训练并观察；红旗症状建议告知家长/老师，必要时就医（红色）
 *
 * 特别处理腿部手术康复期：手术部位的「骨痛」与肌肉酸痛是两回事——
 * 深部钝痛、夜间痛、按压痛属于预警信号，一律停止训练并提醒复诊。
 * 这不是医疗诊断。规则偏保守：对康复期考生，误停几天的成本远低于带伤硬练。
 */
'use strict';

const Safety = (() => {

  const RED_FLAGS = ['头晕', '胸闷/胸痛', '心悸', '恶心想吐', '眼前发黑', '呼吸困难和疼痛'];
  const PAIN_SITES = ['手术部位（腿）', '膝盖', '脚踝', '肘部', '肩部', '腰部'];

  /* q: 问卷数据; history: 最近的 workout 数组（旧的在前）; profile: 用户资料 */
  function evaluate(q, history, profile) {
    const advice = [];
    let level = 'ok';
    const rec = profile && profile.recovery;

    /* 红旗症状：最高优先级 */
    if (q.redflags && q.redflags.length) {
      return {
        level: 'stop',
        title: '今天必须停止训练',
        advice: [
          `你勾选了「${q.redflags.join('、')}」——这是身体发出的明确警报，请立即停止一切训练。`,
          '立刻告诉家长或体育老师发生了什么；如果症状持续、加重，或伴随胸痛、晕厥，尽快就医检查。',
          '今天剩下的时间：坐下或躺下休息、小口补水、不要独处。症状缓解后至少再休息 1-2 天，恢复训练从最轻松的量开始。',
        ],
      };
    }

    /* 手术部位疼痛：康复期的头号警报 */
    if (rec && rec.legSurgery && q.pain && q.pain.includes('手术部位（腿）')) {
      return {
        level: 'stop',
        title: '手术部位疼痛 · 立即停止跳跃和跑步',
        advice: [
          '手术部位出现疼痛要和肌肉酸痛严格区分：肌肉酸是「练完弥漫性的、两三天就消退」；而手术处的深部钝痛、按压痛、夜间痛是骨头给你的警报。',
          '从现在到疼痛消失：暂停一切跑跳（引体和核心可以继续），疼痛部位避免按压撞击。',
          '把疼痛出现的时间、位置、动作告诉家长，并尽快复诊告诉手术医生——这比任何训练都重要。疼痛完全消失后，从「康复适应第 1 级」重新开始，不要直接跳回原计划。',
        ],
      };
    }

    /* 关节疼痛 */
    if (q.pain && q.pain.length) {
      if (q.soreness === 'heavy') {
        level = 'stop';
        advice.push(`${q.pain.join('、')}疼痛且全身酸痛严重——立刻停训。疼痛部位 48 小时内冰敷（每次 15 分钟）、避免跑跳；超过 3 天不缓解或加重，去医院运动医学科检查。`);
      } else {
        level = 'caution';
        advice.push(`${q.pain.join('、')}有疼痛感：接下来 2-3 天避开刺激它的动作（膝/踝→少跳少跑、肘/肩→少拉杠、腰→少跳跃），训练后冰敷 15 分钟；同一部位疼超过 3 天，先检查再练。`);
      }
    }

    /* RPE 疲劳 */
    if (q.rpe >= 9) {
      if (level === 'ok') level = 'caution';
      advice.push('主观疲劳 9/10 属于超量信号：明天只安排主动恢复（拉伸、散步），后天再回计划。连续两次这么累说明量偏大，去「计划」页把每周天数调低一档。');
    } else if (q.rpe >= 7.5) {
      if (level === 'ok') level = 'caution';
      advice.push('这次训练很吃力：今晚提前 1 小时睡，明天若有训练，强度降低 10-15%。');
    }

    /* 连续高强度 */
    const recent = (history || []).slice(-2);
    if (recent.length === 2 && recent.every(w => w && w.rpe >= 7.5)) {
      if (level === 'ok') level = 'caution';
      advice.push('连续两天 RPE ≥ 7.5：明天改成主动恢复日。进步发生在恢复里，不在硬撑里。');
    }

    /* 酸痛 */
    if (q.soreness === 'heavy' && level === 'ok') {
      level = 'caution';
      advice.push('全身酸痛明显：今天/明天做主动恢复（拉伸、慢走、泡沫轴），跳过爆发和间歇课，酸痛降到「轻微」再回计划。');
    } else if (q.soreness === 'mild') {
      advice.push('轻微酸痛是正常的适应反应，按计划练没问题，训练前多花 3 分钟热身酸痛部位。');
    }

    /* 睡眠 */
    if (q.sleepH > 0) {
      if (q.sleepH < 6) {
        if (level === 'ok') level = 'caution';
        advice.push(`昨晚只睡 ${q.sleepH} 小时——睡眠不足时受伤风险明显升高，今天只做热身＋技术类低强度内容或干脆休息。康复期尤其如此：骨头和组织的修复大部分发生在睡眠里。`);
      } else if (q.sleepH < 7.5) {
        advice.push('睡眠略低于 8 小时：今天训练量砍两成，今晚早点睡。');
      }
    }

    /* 静息心率 */
    if (q.restingHr > 0) {
      const base = recentBaselineHr(history);
      if (base && q.restingHr >= base + 8) {
        if (level === 'ok') level = 'caution';
        advice.push(`静息心率 ${q.restingHr} 次/分，比你近期平均（约 ${base}）高 8 次以上——典型的恢复不足信号。今天改主动恢复日，多喝水、早点睡。`);
      }
    }

    /* 康复期例行提醒 */
    if (rec && rec.legSurgery) {
      if (!rec.doctorClear) {
        advice.push('提醒：你的手术恢复还没经医生确认。下次复诊时问一句「可以正常跑步和跳跃了吗」，确认后到「设置 → 康复记录」里勾选，计划会自动进入正常节奏（跳跃量仍会逐周渐进）。');
      }
      if (q.waterMl > 0 && q.waterMl < 1000) {
        advice.push('今天喝水不到 1 升：骨骼恢复和关节润滑都离不开水，训练前后各补 300-500 毫升，日常总量 1.5-2 升。');
      }
    } else if (q.waterMl > 0 && q.waterMl < 1000) {
      advice.push('今天喝水不到 1 升：训练前后各补 300-500 毫升，日常总量 1.5-2 升。脱水会直接掉成绩，也会增加拉伤风险。');
    }

    if (level === 'ok') {
      advice.push('各项指标正常，身体恢复良好——按计划继续。「没有异常」的日子正是进步的日子，保持住。');
    }

    const titles = { ok: '状态良好 · 按计划进行', caution: '注意 · 建议降低强度', stop: '停下 · 先恢复再训练' };
    return { level, title: titles[level], advice };
  }

  function recentBaselineHr(history) {
    const hrs = (history || []).map(w => w && w.restingHr).filter(h => h && h > 30 && h < 120);
    if (hrs.length < 3) return null;
    const avg = hrs.reduce((a, b) => a + b, 0) / hrs.length;
    return Math.round(avg);
  }

  return { evaluate, RED_FLAGS, PAIN_SITES };
})();
