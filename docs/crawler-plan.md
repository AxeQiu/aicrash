# AICrash.news 爬虫采集方案

## 目标

自动从主流科技/AI 媒体采集负面新闻，关键词初筛 + LLM 评分，只入库 severity >= 1 的严肃/负面信息。

---

## 1. 信息源

### 英文源（RSS）

| 媒体 | RSS 地址 | 采集频率 |
|------|----------|----------|
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 30min |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | 30min |
| Wired AI | https://www.wired.com/feed/tag/ai/latest/rss | 30min |
| Reuters Technology | https://feeds.reuters.com/reuters/technologyNews | 15min |
| Bloomberg Technology | https://feeds.bloomberg.com/technology.rss | 30min |
| MIT Tech Review AI | https://www.technologyreview.com/feed/ | 60min |
| Ars Technica AI | https://feeds.arstechnica.com/arstechnica/technology-lab | 30min |

### 中文源（RSS/网页）

| 媒体 | 采集方式 | 采集频率 |
|------|----------|----------|
| 36kr AI 频道 | RSS: https://36kr.com/feed | 30min |
| 虎嗅 AI | RSS: https://www.huxiu.com/rss/0.xml | 30min |
| 量子位 | RSS: https://www.jiqizhixin.com/rss | 30min |
| 机器之心 | RSS: https://www.jiqizhixin.com/rss | 30min |
| IT之家 AI | 网页爬取 | 30min |

> 注意：部分中文媒体 RSS 可能需要验证可用性，不可用时回退到网页爬取。

---

## 2. 过滤流程

```
RSS/网页采集
    │
    ▼
① 时效过滤：published_at 在 24h 以内
    │
    ▼
② 去重：url 已存在则跳过
    │
    ▼
③ 关键词初筛（标题+摘要）
    │  命中负面关键词 → 进入 LLM 评分
    │  未命中 → 丢弃
    ▼
④ LLM 评分
    │  severity >= 1 → 入库
    │  severity = 0 → 丢弃
    ▼
⑤ 入库（中英文各一条）
```

### 2.1 关键词词库

**英文负面关键词**（标题或摘要命中任一即通过初筛）：
```
layoff, layoffs, fired, firing, cut, cuts, shutdown, shut down, shut down,
collapse, crash, plunge, plummet, breach, hack, hacked, vulnerability,
vulnerable, flaw, bug, error, failure, failed, fail, lawsuit, sued, sue,
fine, fined, penalty, ban, banned, regulate, regulation, restrict, restricted,
investigate, investigation, probe, scandal, fraud, deceptive, hallucination,
hallucinate, bias, biased, discriminate, discriminatory, dangerous, risk,
risk, unsafe, harm, harmful, toxic, misinformation, disinformation, fake,
deepfake, copyright, infringe, infringement, steal, stolen, privacy,
surveillance, exploit, exploited, abuse, abused, warning, warn, concern,
concerned, crisis, crisis, troubled, trouble, decline, declining, drop,
dropped, loss, lose, losing, worst, worse, downgrade, downgrade, pessimistic,
bubble, overhype, overhyped, disappointment, disappointing
```

**中文负面关键词**：
```
裁员, 裁减, 解雇, 开除, 下岗, 倒闭, 破产, 关停, 停运, 崩盘,
暴跌, 暴雷, 跌停, 腰斩, 缩水, 蒸发, 漏洞, 后门, 黑客, 攻击,
入侵, 泄露, 泄漏, 数据泄露, 隐私, 监控, 监管, 处罚, 罚款,
立案, 调查, 诉讼, 起诉, 被告, 侵权, 盗版, 抄袭, 封禁, 下架,
约谈, 整改, 幻觉, 偏见, 歧视, 危险, 有害, 有毒, 虚假, 造假,
深度伪造, 伦理, 失控, 失灵, 故障, 事故, 失败, 泡沫, 过度炒作,
风险, 警告, 担忧, 危机, 困境, 下滑, 萎缩, 退步, 降级, 丑闻,
欺诈, 误导, 操控, 操纵, 滥用, 误用
```

### 2.2 LLM 评分

调用 LLM API（如 DeepSeek / OpenAI / Claude），输入标题+摘要，输出：

```json
{
  "is_negative": true,
  "severity": 3,
  "category": "5",
  "summary_en": "Brief English summary",
  "summary_zh": "简要中文摘要"
}
```

**Prompt 模板**：

```
你是一个 AI 行业风险事件分析师。判断以下新闻是否属于负面/严肃事件。

评分标准：
- severity 0: 正面/利好消息（如融资、突破、增长）→ 必须返回 is_negative: false
- severity 1: 轻微问题（如小bug、非关键人员离职）
- severity 2: 中等问题（如产品延迟、小规模裁员）
- severity 3: 较严重（如诉讼、监管调查、数据泄露）
- severity 4: 严重（如大规模裁员、重大安全漏洞、巨额罚款）
- severity 5: 重大危机（如公司倒闭、灾难性事故、行业级冲击）

分类（category）：
- 1: 产业格局（行业洗牌、并购失败、市场萎缩）
- 2: 商业与财务（裁员、亏损、股价暴跌、融资失败）
- 3: 安全与隐私（数据泄露、漏洞、隐私侵犯、幻觉问题）
- 4: 就业与经济（大规模裁员、就业冲击）
- 5: 技术风险（故障、幻觉、偏见、误用）
- 6: 监管与政策（诉讼、罚款、监管、禁令）
- 7: 社会影响（伦理争议、深度伪造、舆论危机）
- 0: 其他

新闻标题：{title}
新闻摘要：{summary}

请以 JSON 格式返回：is_negative, severity, category, summary_en, summary_zh
```

---

## 方案 A：项目内建爬虫模块

> 在 Node.js 项目中内建爬虫，通过 RSS 解析 + 关键词过滤 + LLM API 评分实现自动采集。

### 流程

```
RSS/网页采集
    │
    ▼
① 时效过滤：published_at 在 24h 以内
    │
    ▼
② 去重：url 已存在则跳过
    │
    ▼
③ 关键词初筛（标题+摘要）
    │  命中负面关键词 → 进入 LLM 评分
    │  未命中 → 丢弃
    ▼
④ LLM 评分
    │  severity >= 1 → 入库
    │  severity = 0 → 丢弃
    ▼
⑤ 入库（中英文各一条）
```

### 项目结构

```
server/
├── crawler/
│   ├── index.js          # 爬虫调度器（定时任务入口）
│   ├── sources.js        # 信源配置（RSS 地址、采集频率）
│   ├── rss-parser.js     # RSS 解析（使用 rss-parser 库）
│   ├── web-scraper.js    # 网页爬取（备选，使用 cheerio）
│   ├── filter.js         # 关键词初筛
│   ├── llm-scorer.js     # LLM 评分
│   └── keywords.js       # 关键词词库
```

### 依赖

- `rss-parser` — RSS/Atom 解析
- `cheerio` — 网页内容提取（备选）
- `node-cron` — 定时任务调度
- LLM API — 通过 HTTP 调用（无需额外 SDK）

### 定时任务

```javascript
// 每 30 分钟执行一次
cron.schedule('*/30 * * * *', async () => {
  await crawlAllSources();
});
```

### 去重逻辑

以 `url` 为唯一标识，入库前查询是否已存在：
```sql
SELECT id FROM news WHERE url = ? LIMIT 1
```

### 入库

每条新闻同时写入中英文两条记录（lang='zh' 和 lang='en'），共享同一 url。

### 优缺点

| 优点 | 缺点 |
|------|------|
| 完全自主可控 | 项目臃肿，爬虫代码混入业务 |
| 采集频率灵活 | 需维护 RSS 解析 + 网页爬取 + 定时任务 |
| 可精细控制过滤逻辑 | 需额外依赖（rss-parser, cheerio, node-cron） |

---

## 方案 B：龙虾定时任务 + LLM Agent（推荐）

> 通过龙虾（外部定时任务平台）调度，让 LLM Agent 自主搜索信源、判断负面性、去重并直接写入数据库。项目本身不增加任何爬虫代码。

### 核心思路

LLM Agent 本身具备联网搜索能力，无需我们编写爬虫。只需在 prompt 中指定信源和关键词，Agent 会自行搜索、筛选、评分、去重、入库。

### 流程

```
龙虾定时触发（每 30min）
    │
    ▼
LLM Agent 执行 prompt
    │
    ├→ 判断当前时间
    ├→ 按负面关键词搜索指定信源中 24h 内的 AI 动态
    ├→ 选取 1 条重要负面新闻
    ├→ 通过 mysql-mcp-server 查询 news 表去重
    │   ├→ url 已存在 → 放弃，继续搜索（最多 3 次）
    │   └→ url 不存在 → 继续
    ├→ 评分 + 分类
    └→ 通过 mysql-mcp-server INSERT 写入 news 表
```

### Prompt 模板

```
你是一个 AI 行业风险事件分析师。判断以下新闻是否属于负面/严肃事件。

先判断当前时间，然后从信源中选择一个，按负面关键词搜索发布时间在1天以内的AI 领域的1条重要的负面或严肃新闻。

关键词列表：
**中文负面关键词**：
```
裁员, 裁减, 解雇, 开除, 下岗, 倒闭, 破产, 关停, 停运, 崩盘,
暴跌, 暴雷, 跌停, 腰斩, 缩水, 蒸发, 漏洞, 后门, 黑客, 攻击,
入侵, 泄露, 泄漏, 数据泄露, 隐私, 监控, 监管, 处罚, 罚款,
立案, 调查, 诉讼, 起诉, 被告, 侵权, 盗版, 抄袭, 封禁, 下架,
约谈, 整改, 幻觉, 偏见, 歧视, 危险, 有害, 有毒, 虚假, 造假,
深度伪造, 伦理, 失控, 失灵, 故障, 事故, 失败, 泡沫, 过度炒作,
风险, 警告, 担忧, 危机, 困境, 下滑, 萎缩, 退步, 降级, 丑闻,
欺诈, 误导, 操控, 操纵, 滥用, 误用
```
**英文负面关键词**：
```
layoff, layoffs, fired, firing, cut, cuts, shutdown, shut down,
collapse, crash, plunge, plummet, breach, hack, hacked, vulnerability,
vulnerable, flaw, bug, error, failure, failed, fail, lawsuit, sued, sue,
fine, fined, penalty, ban, banned, regulate, regulation, restrict, restricted,
investigate, investigation, probe, scandal, fraud, deceptive, hallucination,
hallucinate, bias, biased, discriminate, discriminatory, dangerous, risk,
unsafe, harm, harmful, toxic, misinformation, disinformation, fake,
deepfake, copyright, infringe, infringement, steal, stolen, privacy,
surveillance, exploit, exploited, abuse, abused, warning, warn, concern,
concerned, crisis, troubled, trouble, decline, declining, drop, dropped,
loss, lose, losing, worst, worse, downgrade, pessimistic, bubble,
overhype, overhyped, disappointment, disappointing
```

信源地址：
**中文信源**：
```
https://36kr.com/information/AI/
https://www.huxiu.com/channel/106.html
https://www.jiqizhixin.com/
https://www.ithome.com/tag/AI/
```
**英文信源**：
```
https://techcrunch.com/category/artificial-intelligence/
https://www.theverge.com/ai-artificial-intelligence
https://www.wired.com/tag/ai/
https://www.reuters.com/technology/artificial-intelligence/
https://www.bloomberg.com/technology
https://www.technologyreview.com/topic/artificial-intelligence/
https://arstechnica.com/ai/
```

评分标准：
- severity 0: 正面/利好消息（如融资、突破、增长）→ 放弃，不要入库
- severity 1: 轻微问题（如小bug、非关键人员离职）
- severity 2: 中等问题（如产品延迟、小规模裁员）
- severity 3: 较严重（如诉讼、监管调查、数据泄露）
- severity 4: 严重（如大规模裁员、重大安全漏洞、巨额罚款）
- severity 5: 重大危机（如公司倒闭、灾难性事故、行业级冲击）

分类（category）：
- 1: 产业格局（行业洗牌、并购失败、市场萎缩）
- 2: 商业与财务（裁员、亏损、股价暴跌、融资失败）
- 3: 安全与隐私（数据泄露、漏洞、隐私侵犯、幻觉问题）
- 4: 就业与经济（大规模裁员、就业冲击）
- 5: 技术风险（故障、幻觉、偏见、误用）
- 6: 监管与政策（诉讼、罚款、监管、禁令）
- 7: 社会影响（伦理争议、深度伪造、舆论危机）
- 0: 其他

拿到新闻后：
使用 mysql-mcp-server-aicrash-database 检查 news 表中 url 列是否已经包含该新闻信源的链接，若已有则放弃这条新闻，继续搜索，若3次均已有则结束任务。

评分标准严格按照1-5分等级，不能超出范围。

分类（category）必须从以上列表中选择一个，不能超出范围。

把这条新闻插入到 news 表中，保证 summary、title、category 与信源语言一致（英文或中文），若为中文信源，lang 列写入 zh，若为英文信源，lang 写入 en。中英文不需要互译。

INSERT 语句示例：
INSERT INTO news (url, lang, title, summary, source, category, severity, published_at)
VALUES ('新闻链接', 'zh或en', '标题', '摘要', '来源', '分类编号', 严重度数字, '发布时间');
```

### 关键词词库（嵌入 prompt）

**中文负面关键词**：
```
裁员, 裁减, 解雇, 开除, 下岗, 倒闭, 破产, 关停, 停运, 崩盘,
暴跌, 暴雷, 跌停, 腰斩, 缩水, 蒸发, 漏洞, 后门, 黑客, 攻击,
入侵, 泄露, 泄漏, 数据泄露, 隐私, 监控, 监管, 处罚, 罚款,
立案, 调查, 诉讼, 起诉, 被告, 侵权, 盗版, 抄袭, 封禁, 下架,
约谈, 整改, 幻觉, 偏见, 歧视, 危险, 有害, 有毒, 虚假, 造假,
深度伪造, 伦理, 失控, 失灵, 故障, 事故, 失败, 泡沫, 过度炒作,
风险, 警告, 担忧, 危机, 困境, 下滑, 萎缩, 退步, 降级, 丑闻,
欺诈, 误导, 操控, 操纵, 滥用, 误用
```

**英文负面关键词**：
```
layoff, layoffs, fired, firing, cut, cuts, shutdown, shut down,
collapse, crash, plunge, plummet, breach, hack, hacked, vulnerability,
vulnerable, flaw, bug, error, failure, failed, fail, lawsuit, sued, sue,
fine, fined, penalty, ban, banned, regulate, regulation, restrict, restricted,
investigate, investigation, probe, scandal, fraud, deceptive, hallucination,
hallucinate, bias, biased, discriminate, discriminatory, dangerous, risk,
unsafe, harm, harmful, toxic, misinformation, disinformation, fake,
deepfake, copyright, infringe, infringement, steal, stolen, privacy,
surveillance, exploit, exploited, abuse, abused, warning, warn, concern,
concerned, crisis, troubled, trouble, decline, declining, drop, dropped,
loss, lose, losing, worst, worse, downgrade, pessimistic, bubble,
overhype, overhyped, disappointment, disappointing
```

### 信源地址（嵌入 prompt）

**英文信源**：
```
https://techcrunch.com/category/artificial-intelligence/
https://www.theverge.com/ai-artificial-intelligence
https://www.wired.com/tag/ai/
https://www.reuters.com/technology/artificial-intelligence/
https://www.bloomberg.com/technology
https://www.technologyreview.com/topic/artificial-intelligence/
https://arstechnica.com/ai/
```

**中文信源**：
```
https://36kr.com/information/AI/
https://www.huxiu.com/channel/106.html
https://www.jiqizhixin.com/
https://www.ithome.com/tag/AI/
```

### 龙虾定时任务配置

- **触发频率**: 每 30 分钟
- **执行内容**: 调用 LLM Agent，传入上述 prompt
- **超时**: 5 分钟
- **失败重试**: 1 次

### 优缺点

| 优点 | 缺点 |
|------|------|
| 项目零代码侵入，不增加依赖 | 依赖龙虾平台 + MCP Server 可用性 |
| LLM 自主搜索，无需维护 RSS 解析 | 每次只采集 1 条，频率需保证 |
| 去重和入库由 Agent 通过 SQL 完成 | Agent 行为不完全可控，需监控 |
| Prompt 可随时调整，无需重新部署 | LLM 成本略高于方案 A（每次需联网搜索） |

---

## 方案对比

| 维度 | 方案 A（内建爬虫） | 方案 B（龙虾 + Agent） |
|------|-------------------|----------------------|
| 项目侵入 | 高（新增 6+ 文件、3+ 依赖） | 零（不改动项目代码） |
| 维护成本 | 高（RSS 失效、爬虫异常） | 低（只维护 prompt） |
| 采集量 | 高（批量采集所有文章） | 中（每次 1 条，靠频率补） |
| 可控性 | 高（代码逻辑确定） | 中（LLM 行为有随机性） |
| 部署复杂度 | 中（需部署定时任务） | 低（龙虾平台配置即可） |
| 推荐度 | 适合需要大批量采集 | **适合当前阶段** |

> **推荐方案 B**：项目早期阶段，保持项目精简更重要。龙虾 + Agent 方案零侵入、易调整，后续如需大批量采集再考虑方案 A。
