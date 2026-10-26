# 薄肌与自律

体育中考三项（1000 米 · 立定跳远 · 引体向上）备战 PWA。本地优先、无需上架 App Store，
在 iPhone 上通过 Safari「添加到主屏幕」即可像原生 App 一样全屏使用。

> 「薄肌从来不是讨好世界的筹码，而是你拿回人生主动权的第一步。」

## 功能

- **科学课表**：按周期化自动生成——基础期 → 强化期 → 冲刺期 → 考前减量周；每 4 周一个减量周。
  工作日 20-30 分钟短课（放学后能练完），周末主课（测试/间歇/爆发力）。
- **手术康复分期**：腿部手术康复期自动进入保守渐进（不跳跃 → 低冲击 → 渐进冲击 → 正常），
  复诊确认后可在设置里勾选解锁。
- **训练后问卷 + 本地安全规则**：RPE、睡眠、酸痛、疼痛部位、红线症状；不联网也能即时给出
  分级建议（继续 / 降强度 / 停止并告知家长）。手术部位疼痛 = 一票停止。
- **AI 分析**（可选）：填入任意 OpenAI 兼容接口（默认智谱 `glm-4-flash`，有免费额度），
  获得 AI 状态解读与下周计划调整；若浏览器跨域受限，一键复制提示词到任意 AI 助手。
- **成绩记录与趋势**：三项目成绩录入、趋势图（含目标参考线）、打卡历史、连续打卡天数。
- **饮食 · 作息 · 习惯**：自律清单、睡眠趋势、饮水记录、青少年饮食原则与康复期营养。
- **数据自持**：全部数据只存在设备浏览器里，支持导出/导入 JSON 备份。

## 放到 iPhone 上（三种方式任选）

### 方式 A：GitHub Pages（推荐，手机随时可用）

1. 在 GitHub 新建一个仓库（如 `bjzl`），把本目录所有文件推上去；
2. 仓库 Settings → Pages → Source 选 `main` 分支 / 根目录，保存；
3. 一分钟后得到 `https://<你的用户名>.github.io/bjzl/`；
4. iPhone Safari 打开该网址 → 分享按钮 → **添加到主屏幕**。

### 方式 B：局域网预览（同一 Wi-Fi）

电脑上运行 `python -m http.server 8899 --directory <本目录>`，
iPhone Safari 访问 `http://<电脑局域网IP>:8899`（电脑防火墙需放行 8899）。

### 方式 C：其他静态托管

Vercel / Netlify / Cloudflare Pages 拖拽部署即可，无任何构建步骤。

> 「添加到主屏幕」后以独立窗口运行；配合自带的 Service Worker 可离线使用。

## AI 配置

设置 → AI 分析，有两个一键预设：

| 服务商 | 接口地址 | 模型 | 说明 |
| --- | --- | --- | --- |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-chat` | **浏览器可直连，app 内全自动**；按量计费，个人用量约几毛/月 |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | 有免费额度，但浏览器跨域被拦，只能「复制提示词」 |

可选模型还有 `deepseek-reasoner`（更强也更慢，适合看复杂状态）。API Key 只保存在本机
localStorage，请求由设备直连服务商，不经过任何第三方。

> 快捷方式：打开带 `?key=你的Key&base=https%3A%2F%2Fapi.deepseek.com&model=deepseek-chat`
> 的链接，app 自动保存并立即从地址栏清除。

### 关于跨域

- **DeepSeek 允许浏览器跨域直连**（2026-10 实测 HTTP 200），因此 app 内「AI 深度分析」
  「AI 调整下周计划」可直接全自动工作；
- 智谱接口不允许浏览器直连，会提示失败并自动提供**「复制提示词」**降级方案；
- 若日后需要别的服务商，可用 `tools/cf-worker.js` 部署一个免费的 Cloudflare Worker 中转
  （只转发目标服务商、只放行你的站点，密钥不落 Worker），把接口地址改成 Worker 地址即可。

## 训练依据（app 内的权威来源）

| 要点 | 来源 |
| --- | --- |
| 每天 60 分钟中高强度活动、每周 3 天肌肉骨骼强化 | [WHO《身体活动与久坐行为指南》](https://www.who.int/zh/news-room/fact-sheets/detail/physical-activity)、中国人群身体活动指南(2021) |
| 青少年抗阻训练安全、1-3 组 × 6-15 次、每周 2-3 个非连续日 | [NSCA Youth Resistance Training Position Statement (2009)](https://www.nsca.com/education/articles/infographics/youth-resistance-training/) |
| 增强式训练从低量开始、先掌握落地 | NSCA 立场声明（plyometric 部分） |
| 周期化、每 4 周减量、考前 taper | 运动训练学通识 |
| 蛋白质 1.2-1.6 g/kg/天、青少年取值 | ACSM/ISSN 立场（青少年取保守值） |
| 青少年每晚 8-10 小时睡眠 | 美国儿科学会(AAP)/CDC |

## 安全声明

本应用提供一般性训练参考，不构成医疗建议。未成年人训练请在家长或老师知情下进行；
出现胸痛、头晕、关节锐痛或手术部位疼痛，立即停止并告知大人，必要时就医。
开始恢复训练前，请先确认手术医生允许跑跳。

## 项目结构

```
index.html            应用外壳
manifest.webmanifest  PWA 清单
sw.js                 Service Worker（离线缓存）
css/style.css         设计系统（深浅双主题，跟随系统）
js/util.js            通用工具（日期 / 成绩解析 / 渲染辅助）
js/store.js           localStorage 数据层
js/plan.js            训练计划引擎（周期化 + 康复分期）
js/safety.js          本地安全规则引擎
js/charts.js          轻量 SVG 图表
js/analysis.js        AI 接口与提示词
js/app.js             路由与视图
assets/               应用图标
tools/                图标生成 / 括号检查脚本（开发用）
```

## 开发备注

- 改了 JS/CSS 后，同步把 `index.html` 里的 `?v=版本号` 升一位，避免浏览器/SW 缓存旧文件。
- `tools/make-icons.ps1` 可重新生成图标（PowerShell）。
- `tools/check_parens.py <文件>` 可粗查 JS 括号平衡（Python）。
