/* 薄肌与自律 · 训练计划引擎
 *
 * 按用户实际情况定制：
 *  - 场地：学校操场 + 单杠 + 徒手（无跳绳/弹力带/哑铃）
 *  - 时间：工作日放学后只有 20-30 分钟 → 工作日短课；周末可以练长课
 *  - 三项目：1000 米、立定跳远、引体向上（中考选考组合）
 *  - 腿部手术康复期（未获医生确认）→ 康复分期渐进，跳跃强度按周数爬坡
 *  - 目标：冲三项满分
 *
 * 周期化：基础期（≥9 周）→ 强化期（5-8 周）→ 冲刺期（3-4 周）→ 考前周（≤10 天减量）。
 * 每 4 周一个减量周（-30%），防止过度训练。未成年人不做负重与力竭训练。
 */
'use strict';

const Plan = (() => {

  /* ---------- 配速与水平 ---------- */

  function paces(targetSec) {
    if (!targetSec) return null;
    return {
      interval400: Math.round(targetSec * 0.4 * 0.97),   // 400 米间歇：略快于目标配速
      tempoKm: Math.round(targetSec * 1.08),             // 节奏跑：比目标慢 8%/公里
      easyKm: Math.round(targetSec * 1.35),              // 有氧：轻松配速/公里
    };
  }

  /* 引体水平分档（0-4 档），档位决定力量课内容 */
  function pullLevel(n) {
    if (n === null || n === undefined) return 1;
    if (n === 0) return 0;
    if (n <= 5) return 1;
    if (n <= 10) return 2;
    if (n <= 14) return 3;
    return 4;
  }

  function phaseFor(daysToExam) {
    if (daysToExam > 63) return 'base';
    if (daysToExam > 28) return 'build';
    if (daysToExam > 14) return 'peak';
    return 'taper';
  }
  const PHASE_NAMES = {
    base: '基础期 · 打底子',
    build: '强化期 · 上强度',
    peak: '冲刺期 · 磨细节',
    taper: '考前周 · 减量调整',
  };

  /* ---------- 手术康复分期 ----------
   * stage 0（术后/起训前 2 周）：不跳跃。走跑结合 + 下肢力量重建
   * stage 1（第 3-4 周）：低冲击。轻松跑 + 短加速；跳远只做技术与小幅跳
   * stage 2（第 5-6 周）：渐进冲击。完整跳远恢复 + 节奏跑
   * stage 3（第 7 周起）：恢复正常，按周期走
   * 医生确认可跑跳后，起点可提前到 stage 1，但跳量仍逐周加。
   */
  function recoveryStage(state, refDate) {
    const rec = state.profile().recovery;
    if (!rec || !rec.legSurgery) return 3;
    /* 爬坡从「身体真正开始承压」算起：训练开始日与手术日中较晚的那个。
     * state 是 Store 对象， startDate 存在 Store.state 上。 */
    const anchor = [state.state.startDate, rec.surgeryDate].filter(Boolean).sort().pop() || refDate;
    const weeks = Math.max(0, Math.floor(daysBetween(anchor, refDate) / 7));
    let stage = weeks < 2 ? 0 : weeks < 4 ? 1 : weeks < 6 ? 2 : 3;
    if (rec.doctorClear && stage === 0) stage = 1;   // 已获确认：跳过最保守段，仍渐进
    return stage;
  }
  const RECOVERY_NAMES = {
    0: '康复适应 · 第 0 级（不跳跃）',
    1: '康复适应 · 第 1 级（低冲击）',
    2: '康复适应 · 第 2 级（渐进冲击）',
    3: '',
  };

  /* ---------- 课表内容 ---------- */

  const warm = { name: '热身', tag: 'warm', min: 8, detail: '慢跑 3-5 分钟＋关节活动＋动态拉伸（腿部摆动、弓步转体、高抬腿 2×20 米）。热身是防伤第一道防线，康复期尤其不能省。' };

  function runInterval(phase, p) {
    const reps = phase === 'base' ? 5 : phase === 'build' ? 6 : 7;
    return {
      name: '间歇跑：400 米 × ' + reps, tag: 'run', min: 55,
      detail: `周六主课。热身 12 分钟（含 2 个 80 米加速跑）；400 米 × ${reps} 组，每组 ${fmtRunTime(p.interval400)}（按你的目标配速换算），组间慢走或慢跑 2 分钟；最后 10 分钟慢跑放松＋静态拉伸。前几组控制节奏，最后一组才逐步提速。`,
    };
  }
  function runTempoShort(p) {
    return {
      name: '节奏跑 1200-1600 米', tag: 'run', min: 28,
      detail: `放学短课。热身 8 分钟；以 ${fmtRunTime(p.tempoKm)}/公里的配速连续跑 1200-1600 米——比测试目标稍慢、能说短句的强度；拉伸放松 5 分钟。体会匀速感，这是 1000 米不掉速的根基。`,
    };
  }
  function runEasyShort(p) {
    return {
      name: '轻松有氧 15-18 分钟', tag: 'run', min: 25,
      detail: `配速 ${fmtRunTime(p.easyKm)}/公里左右，能边跑边聊天；跑完加 4 × 60 米加速跑（八成力，跑姿放松），拉伸 5 分钟。`,
    };
  }
  function runTest() {
    return {
      name: '模拟测试：1000 米全力计时', tag: 'test', min: 30,
      detail: '周六主课。充分热身 15 分钟；全力跑 1000 米计时，按考试流程：前 200 米跟上大部队、中段稳住节奏、最后 300 米逐步提速。成绩记到「记录」页。测后慢走 10 分钟放松。',
    };
  }
  function runWalk(p) {
    return {
      name: '走跑结合 15-20 分钟', tag: 'run', min: 22,
      detail: `康复期第一档：慢跑 3 分钟＋走 1 分钟，循环 5-6 轮，配速控制在 ${fmtRunTime(p.easyKm)}/公里以上（很轻松）。手术腿有任何深部疼痛立即停止改走路。`,
    };
  }
  function runStrides(p) {
    return {
      name: '轻松跑 + 短加速', tag: 'run', min: 28,
      detail: `轻松跑 15 分钟（${fmtRunTime(p.easyKm)}/公里左右），然后 4 × 60 米加速跑：前 20 米渐加速到八成力、后 40 米保持，走回恢复。恢复肌肉对「快」的记忆，但冲击很小。`,
    };
  }
  function jumpTechLow() {
    return {
      name: '落地缓冲技术（不腾空）', tag: 'jump', min: 20,
      detail: '康复第 0 级：不跳。①原地提踵 3 × 15（慢上慢下）；②自重深蹲 3 × 10（膝盖对准脚尖）；③落地缓冲练习：从 10-15 厘米台阶小步走下、屈膝屈髋轻落地 8 次 × 2 组，体会「轻轻接住自己」；④臀桥 3 × 15。',
    };
  }
  function jumpTech() {
    return {
      name: '立定跳远：技术课', tag: 'jump', min: 25,
      detail: '放学短课。热身＋踝膝髋激活；①原地摆臂蹬地分解 3 × 8（两臂带向前上方，蹬地角约 45°）；②完整立定跳远 5-6 次，中等力度——重点找术前那个节奏：起跳收腹举腿、落地屈膝缓冲；③收腹跳 2 × 6。数量不大，质量第一，手术腿有感觉就停。',
    };
  }
  function jumpPower(stage) {
    if (stage <= 0) return jumpTechLow();
    if (stage === 1) {
      return {
        name: '下肢力量（低冲击）', tag: 'jump', min: 30,
        detail: '①自重深蹲 3 × 12；②箭步蹲 3 × 8/侧；③提踵 3 × 15；④小幅蛙跳 2 × 4（幅度小、落地轻）；⑤臀桥 3 × 15。冲击量很小，重点是腿部力量重新长回来。',
      };
    }
    return {
      name: '下肢爆发力', tag: 'jump', min: 45,
      detail: '周六主课。热身 10 分钟；①自重深蹲 3 × 12（膝盖对准脚尖）；②箭步蹲 3 × 8/侧；③连续立定跳远 4 × 4（塑胶面，落地要轻）；④收腹跳 3 × 8；⑤提踵 3 × 15。组间充分休息。目标是从术前的 2.50 米重建回满分线。',
    };
  }
  function pullSession(level) {
    const map = {
      0: {
        name: '引体向上：从 0 到 1', tag: 'pull', min: 25,
        detail: '①悬垂 4 × 20-30 秒（肩胛收紧下沉）；②肩胛引体 3 × 6；③离心引体 3 × 3：跳上杠杆，4-5 秒缓慢下放；④再悬垂 2 × 20 秒。组间休息 90 秒。',
      },
      1: {
        name: '引体向上：累积次数', tag: 'pull', min: 25,
        detail: '①用最大次数的一半做 4 组（如最多 4 个就每组 2 个），组间 2 分钟；②弹力带辅助引体 3 × 6（没有弹力带就做跳上后 4 秒离心下放 3 × 4）；③悬垂 2 × 30 秒。',
      },
      2: {
        name: '引体向上：稳定 5 组', tag: 'pull', min: 28,
        detail: '①引体 5 组 × 最大次数的 60%（组间 2-3 分钟；全幅度：手臂伸直→下巴过杠）；②离心引体 2 × 3；③悬垂 2 × 40 秒。',
      },
      3: {
        name: '引体向上：冲满分', tag: 'pull', min: 28,
        detail: '①引体 4 组：前 3 组各做「目标次数 −1」，第 4 组做到力竭前 1 次；②宽距/反手各 1 组 × 60%；③悬垂 2 × 40 秒。全幅度是硬标准——手臂伸直→下巴过杠。',
      },
      4: {
        name: '引体向上：保持与打磨', tag: 'pull', min: 25,
        detail: '15 个以上的水平，重点是稳定和节奏：①引体 4 组 ×（最大 −3）个，2 秒上 2 秒下的节奏，全幅度；②慢速离心 2 × 3（5 秒下放）；③悬垂 2 × 45 秒。每两周的测试日测一次「1 组最多次数」并记录。',
      },
    };
    return map[clamp(level, 0, 4)];
  }
  function pullGtg(level) {
    const n = [1, 2, 3, 5, 7][clamp(level, 0, 4)];
    return {
      name: '引体 GTG：分散练习', tag: 'pull', min: 15,
      detail: `全天分散做 4-5 次，每次 ${n} 个（不力竭、留有余量）：课间、放学后、饭后半小时都行。睡前悬垂 2 × 40 秒。GTG 的秘诀是「每次都新鲜」，感觉累了就停。`,
    };
  }
  function coreSession() {
    return {
      name: '核心＋髋部稳定', tag: 'core', min: 12,
      detail: '平板支撑 3 × 40 秒；死虫式 3 × 10/侧；臀桥 3 × 15；侧平板 2 × 20 秒/侧。核心是跑步后半程不垮、跳远落地不晃的底盘。',
    };
  }
  function mobilitySession() {
    return {
      name: '主动恢复日', tag: 'rest', min: 18,
      detail: '放学后散步 10 分钟＋全身拉伸 10 分钟（重点：腘绳肌、髋屈肌、小腿、胸肩；手术腿的小腿和髋多滚泡沫轴——酸是可以的，骨头疼不行）。这天的任务是让训练「长」在身上。',
    };
  }
  function testSupplement() {
    return {
      name: '立定跳远测验 3 次＋引体测验 1 组', tag: 'test', min: 12,
      detail: '三项各测一次并记录到「记录」页——这是计划自动调整最重要的数据。跳远第一次测验是术后基线，不管跳多少都如实记录。',
    };
  }
  function warmupOnly() {
    return {
      name: '考前热身模板演练', tag: 'rest', min: 25,
      detail: '按考试当天流程完整走一遍：慢跑 5 分钟 → 动态拉伸 → 高抬腿/后踢腿各 2 × 20 米 → 2 个 80 米加速跑 → 立定跳远 2 次找感觉 → 引体 2 个找握感。不疲劳、不测速，只让身体记住流程。',
    };
  }
  function restDay(note) {
    return [{ name: '休息日', tag: 'rest', min: 0, detail: note || '完全休息。可以散步、拉伸，保证 8 小时以上睡眠。' }];
  }

  const FOCUS_NAMES = { run: '跑步', jump: '跳远', pull: '引体', core: '核心', test: '测试', rest: '恢复', warm: '热身' };

  /* ---------- 生成一周 ----------
   * 工作日 = 短课（≤30 分钟，放学后能练完）；周六 = 主课（测试/间歇/爆发，45-60 分钟）；周日 = 全休。
   */
  function buildWeek(weekStartDate, state) {
    const prof = state.profile();
    const cur = state.current();
    const daysToExam = prof.examDate ? daysBetween(weekStartDate, prof.examDate) : 999;
    const phase = phaseFor(daysToExam);
    const stage = recoveryStage(state, weekStartDate);
    const inRecovery = stage < 3;
    const anchor = state.state.startDate || weekStartDate;
    const weekIndex = Math.max(0, Math.floor(daysBetween(anchor, weekStartDate) / 7));
    const deload = !inRecovery && (phase === 'base' || phase === 'build') && weekIndex % 4 === 3;
    const biweeklyTest = weekIndex % 2 === 1 && phase !== 'base' && !inRecovery;

    /* AI 调整计划：若存在且对应当周，直接作为该周课表（可勾选、计入完成度） */
    const ai = state.state.aiPlan;
    if (ai && ai.forWeekStart === weekStartDate && Array.isArray(ai.week) && ai.week.length === 7) {
      const days = ai.week.map((d, i) => {
        const date = addDays(weekStartDate, i);
        const items = (d.items || []).map(it => ({
          name: it.name || '训练',
          tag: /休息/.test(it.name || '') ? 'rest' : 'ai',
          min: Number(it.min) || 0,
          detail: it.detail || '',
        }));
        if (!items.length) items.push({ name: '休息日', tag: 'rest', min: 0, detail: 'AI 安排的休息。' });
        const main = items.find(it => it.tag !== 'rest');
        return {
          date, weekday: WEEKDAY_NAMES[i],
          items, focus: main ? (d.focus || FOCUS_NAMES[main.tag] || '训练') : '休息',
        };
      });
      return {
        weekStart: weekStartDate, phase, phaseName: PHASE_NAMES[phase] + ' · AI 调整',
        inRecovery, stage, deload, days, daysToExam, ai: true,
      };
    }

    const p = paces(prof.targets.run1000);
    const level = pullLevel(cur.pullups);

    let gens;
    if (phase === 'taper' && daysToExam <= 10 && !inRecovery) {
      gens = taperSkeleton(daysToExam);
    } else {
      const n = clamp(prof.daysPerWeek || 5, 3, 6);
      if (n === 3) {
        gens = [
          null,
          () => shortRun(inRecovery, stage, p, phase),
          () => [warm, pullSession(level)], null,
          () => satMain('jump', inRecovery, stage, phase, p, biweeklyTest),
          null, null,
        ];
      } else if (n === 4) {
        gens = [
          () => [warm, pullSession(level)],
          () => shortRun(inRecovery, stage, p, phase),
          null, null,
          () => satMain('jump', inRecovery, stage, phase, p, biweeklyTest),
          null, null,
        ];
      } else if (n === 5) {
        gens = [
          () => [warm, pullSession(level)],                       // 周一 短课：引体
          () => shortRun(inRecovery, stage, p, phase),            // 周二 短课：跑
          () => [mobilitySession()],                              // 周三 恢复
          () => [warm, pullGtg(level), coreSession()],            // 周四 短课：GTG+核心
          () => friShort(inRecovery, stage, p),                   // 周五 短课：跑/跳技术
          () => satMain('run', inRecovery, stage, phase, p, biweeklyTest), // 周六 主课
          null,                                                   // 周日 全休
        ];
      } else {
        gens = [
          () => [warm, pullSession(level)],
          () => shortRun(inRecovery, stage, p, phase),
          () => [warm, runEasyShort(p)],
          () => [warm, pullGtg(level), coreSession()],
          () => friShort(inRecovery, stage, p),
          () => satMain('run', inRecovery, stage, phase, p, biweeklyTest),
          null,                                                   // 周日全休（6 天训练=周一~周六）
        ];
      }
    }

    const days = gens.map((gen, i) => {
      const date = addDays(weekStartDate, i);
      if (!gen) return { date, weekday: WEEKDAY_NAMES[i], items: restDay(), focus: '休息' };
      const items = gen();
      if (deload) markDeload(items);
      const main = items.find(it => it.tag && it.tag !== 'warm');
      return { date, weekday: WEEKDAY_NAMES[i], items, focus: main ? (FOCUS_NAMES[main.tag] || '训练') : '恢复' };
    });

    const phaseName = inRecovery ? RECOVERY_NAMES[stage] : PHASE_NAMES[phase];
    return { weekStart: weekStartDate, phase, phaseName, inRecovery, stage, deload, days, daysToExam };
  }

  /* 工作日的跑步短课：康复期走跑结合 → 低冲击 → 正常节奏跑 */
  function shortRun(inRecovery, stage, p, phase) {
    if (!inRecovery) return [warm, runTempoShort(p)];
    if (stage === 0) return [warm, runWalk(p)];
    if (stage === 1) return [warm, runStrides(p)];
    return [warm, runTempoShort(p)];
  }

  /* 周五短课：康复期只做上肢/核心；低冲击期做跑；之后做跳远技术（量小） */
  function friShort(inRecovery, stage, p) {
    if (stage === 0) return [warm, pullGtg(pullLevel(Store.current().pullups)), coreSession()];
    if (stage === 1) return [warm, runEasyShort(p)];
    return [warm, jumpTech()];
  }

  /* 周六主课：康复期按档位；正常期隔周测试，否则按 emphasis 跑或跳 */
  function satMain(emphasis, inRecovery, stage, phase, p, biweeklyTest) {
    if (inRecovery) {
      if (stage === 0) return [warm, jumpPower(0), runWalk(p)];
      if (stage === 1) return [warm, jumpPower(1), runStrides(p)];
      return [warm, jumpPower(2), runTempoShort(p), testSupplementJump()];
    }
    if (biweeklyTest) return [warm, runTest(), testSupplement()];
    return emphasis === 'jump'
      ? [warm, jumpPower(3), runTempoShort(p)]
      : [warm, runInterval(phase, p), jumpPower(3)];
  }
  function testSupplementJump() {
    return {
      name: '立定跳远测验 3 次', tag: 'test', min: 10,
      detail: '康复期每周六测 3 次立定跳远（中等力度），观察手术腿对冲击的适应情况并记录——数字会告诉你恢复得怎么样。',
    };
  }

  /* 考前 10 天：减量保强度，考前 3 天只留热身演练 */
  function taperSkeleton(daysToExam) {
    const rest = () => restDay('考前充分休息，睡够 8-9 小时，正常吃饭（主食别减），不要尝试任何新的训练或装备。');
    const light = () => [warmupOnly()];
    const sharp = () => [
      warm,
      {
        name: '保持强度小课', tag: 'run', min: 30,
        detail: '热身后：400 米 × 3（目标配速）＋立定跳远 3 次＋引体 3 个（全部按考试标准动作）。强度在、量很小——考前几天依然要「碰一碰速度」，但绝不疲劳。',
      },
    ];
    if (daysToExam <= 1) return [null, null, null, null, null, null, null];
    if (daysToExam <= 3) return [sharp, null, light, null, light, null, null];
    return [light, sharp, null, sharp, light, null, null];
  }

  function markDeload(items) {
    const main = items.find(it => it.tag && it.tag !== 'warm');
    if (!main) return;
    main.min = Math.max(15, Math.round(main.min * 0.7));
    main.detail += '\n\n（本周是减量周：组数和时长按七成执行，动作质量优先，给身体吸收训练的时间。）';
  }

  /* ---------- 参考标准（各地不同，务必以本地为准） ---------- */

  const STANDARDS_REF = [
    { event: '1000 米跑', full: '满分线常见 3\'35" – 3\'50"', note: '多数城市 3\'40" 左右满分；及格线多在 4\'35" – 4\'55"' },
    { event: '立定跳远', full: '满分线常见 2.35 – 2.55 米', note: '男生满分多在 2.40 米上下；及格约 1.90 – 2.10 米' },
    { event: '引体向上', full: '满分线常见 10 – 16 次', note: '地区差异最大的项目：有的城市 10 次满分、有的 16 次，务必查本地文件' },
  ];

  /* ---------- 考前预估 ----------
   * 对已录成绩做趋势外推，但训练进步边际递减，不能匀速直线外推：
   * 近 4 周按实测速率算，之后按一半速率（平台期）算，并夹在合理上限内。
   * 数据少时诚实标注「不准」，随每周测试自动变准。
   */
  function project(records, target, examDate, today, lowerBetter, kind) {
    if (!records || records.length < 2 || !examDate) return null;
    const daysToExam = daysBetween(today, examDate);
    if (daysToExam <= 0) return null;
    const t0 = strToDate(records[0].date).getTime();
    const pts = records.map(r => [(strToDate(r.date).getTime() - t0) / DAY_MS, r.value]);
    const n = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;          // 每天原始变化量
    const latest = records[records.length - 1].value;
    const weeks = Math.min(daysToExam / 7, 16);
    /* 近 4 周全速、之后半速：总进步量（正数=在变好的方向） */
    const ratePerWeek = Math.abs(slope) * 7;
    const rawTotal = ratePerWeek * Math.min(weeks, 4) + ratePerWeek * 0.5 * Math.max(0, weeks - 4);
    let projected = lowerBetter ? latest - rawTotal : latest + rawTotal;
    /* 合理上限，防止长期外推失真 */
    projected = clampProjection(projected, kind);
    const improving = (lowerBetter ? -slope : slope) * 7;
    const needPerWeek = Math.abs(target - latest) / (daysToExam / 7);
    const gap = lowerBetter ? target - projected : projected - target;
    const achieved = gap >= 0;
    const near = achieved || Math.abs(gap) <= Math.abs(target) * 0.04;
    const verdict = achieved ? '可达成 ✓' : near ? '逼近目标' : '需要提速';
    return {
      projected, improving, needPerWeek, daysToExam,
      achieved, verdict,
      confident: n >= 4,
      points: n,
    };
  }

  /* 预估值的合理边界：时间 2'30"–6'40"、距离 3.2 米、次数 40 个 */
  function clampProjection(v, kind) {
    if (kind === 'time') return clamp(v, 150, 400);
    if (kind === 'distance') return Math.min(v, 3.2);
    if (kind === 'count') return Math.min(v, 40);
    return v;
  }

  /* ---------- 训练依据（权威来源的要点，展示在计划页） ---------- */

  const EVIDENCE = [
    {
      h: '每天 60 分钟是底座',
      p: 'WHO《身体活动与久坐行为指南》：5-17 岁每天至少 60 分钟中高强度活动（有氧为主），每周至少 3 天剧烈有氧与肌肉骨骼强化。你的课表加体育课已覆盖大部分，课间多走动跳绳即可补足。',
      src: 'WHO 2020 指南 / 中国人群身体活动指南(2021)',
    },
    {
      h: '1000 米七成靠有氧',
      p: '中距离跑的供能约七至八成依赖有氧系统——所以课表先打有氧底（轻松跑/节奏跑），再间歇课拉最大摄氧量上限；比赛策略用全程匀速、最后 300 米逐步提速，这是运动生理学对中距离跑的标准结论。',
      src: '运动生理学通识（中距离跑供能特征）',
    },
    {
      h: '青少年力量训练是安全的',
      p: 'NSCA 立场声明：在动作质量优先、有监督的前提下，青少年抗阻训练安全且有益。推荐 1-3 组 × 6-15 次、每周 2-3 个不连续日。你的课表只做自重、不做负重与力竭，正处于该框架内。',
      src: 'NSCA Youth Resistance Training Position Statement (Faigenbaum et al., 2009)',
    },
    {
      h: '跳跃先学落地，再渐进冲击',
      p: 'NSCA 对青少年增强式训练的要求：从低量低强度开始、先掌握落地缓冲技术，再逐步加量。课表的跳跃课次数少、质量优先，且安排在塑胶/草地等软质地面；手术康复期的分级渐进同源于此逻辑。',
      src: 'NSCA Position Statement（plyometric/增强式训练部分）',
    },
    {
      h: '减量周与考前 taper',
      p: '训练适应发生在恢复期。每 4 周插入减量周（总量 -30%）、考前一周减量保强度，让身体在考试日达到峰值——这是竞技体育标准做法，同样适用于中考备考。',
      src: '运动训练学（周期化与 taper 通识）',
    },
    {
      h: '「薄肌」= 体成分，不是体重数字',
      p: '对未成年人：不节食、不碰减重药与成人补剂。足量蛋白（约 1.2-1.6 g/kg/天）、睡够 8-10 小时、规律训练，身材自然走向精瘦——这正是「薄肌」的科学实现路径。',
      src: 'ACSM/ISSN 关于运动员蛋白摄入的立场（青少年取保守值）',
    },
    {
      h: '睡眠是第二训练',
      p: '青少年推荐每晚 8-10 小时睡眠：生长激素分泌与肌肉、骨骼修复主要在深睡中完成。睡眠不足直接拉高受伤风险、拖慢成绩进步——app 的问卷每晚都在盯这一项。',
      src: '美国儿科学会(AAP)/CDC 青少年睡眠建议',
    },
  ];

  const PHASE_INTENT = {
    base: '目标：把有氧底子和动作模式打牢，成绩会在后程加速',
    build: '目标：强度上台阶，间歇与爆发力把上限拉高',
    peak: '目标：强度保持、总量回落，把状态磨到峰值',
    taper: '目标：减量恢复，让身体在考试日达到最佳',
  };

  return { paces, pullLevel, phaseFor, recoveryStage, PHASE_NAMES, RECOVERY_NAMES, buildWeek, STANDARDS_REF, FOCUS_NAMES, project, EVIDENCE, PHASE_INTENT };
})();
