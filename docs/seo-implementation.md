# AICrash.news SEO 实施文档

## 概述

本文档记录了 AICrash.news 的 SEO 优化实施内容，包括 meta 标签、服务端渲染（SSR）、结构化数据、OG 图片等。

---

## 1. 首页 Meta 标签

**文件**: `public/index.html`

| 标签 | 用途 |
|------|------|
| `<meta name="description">` | 搜索结果摘要 |
| `<meta property="og:title/description/type/site_name/url">` | 社交平台分享 |
| `<meta name="twitter:card/title/description/image">` | Twitter 分享 |
| `<link rel="canonical">` | 规范化 URL，避免重复收录 |
| `<link rel="alternate" hreflang="zh/en/x-default">` | 多语言声明 |

---

## 2. 文章页 SSR（服务端渲染）

**文件**: `server/index.js` — `/article/*` 路由

### 问题

文章页原为纯 SPA，所有内容通过 JS 异步加载。搜索引擎爬虫抓到的 HTML 是空壳（只有"加载中..."），导致无法收录。

### 方案

在服务端路由中查询数据库，将文章内容直接注入到 HTML 中返回。

### 注入内容

**`<head>` 注入**:
- `<title>文章标题 - AICrash.news</title>`
- `<meta name="description">` 带文章摘要
- `<meta property="og:title/description">` 带文章内容
- `<link rel="canonical">` 基于请求 URL 生成
- `<link rel="alternate" hreflang="zh/en/x-default">`
- `<meta property="og:image">` 指向动态 OG 图片
- `<script type="application/ld+json">` JSON-LD 结构化数据

**`<body>` 注入**:
- 严重度徽章 + `<h1>` 标题
- 文章摘要
- 返回首页链接
- 侧边栏：严重度、分类、来源、发布时间、入库时间、原文链接

### 去重处理

SSR 注入前先移除 `article.html` 中的占位标签，避免重复：
- `<title>`
- `<meta name="description">`
- `<meta property="og:title">`
- `<meta property="og:description">`
- `<script type="application/ld+json">`

---

## 3. 结构化数据（JSON-LD）

**文件**: `server/index.js` — SSR 注入

每个文章页注入 `NewsArticle` schema：

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "文章标题",
  "description": "文章摘要",
  "datePublished": "发布时间",
  "dateModified": "入库时间",
  "publisher": {
    "@type": "Organization",
    "name": "AICrash.news",
    "url": "https://aicrash.news"
  },
  "sourceOrganization": {
    "@type": "Organization",
    "name": "来源名称"
  },
  "articleSection": "分类",
  "keywords": "AI, crash, news, 分类",
  "url": "原文URL"
}
```

作用：搜索引擎可在结果中展示富文本摘要（发布日期、来源等）。

---

## 4. OG 图片（社交分享预览图）

**文件**: `server/og.js` + `server/index.js`

### 首页品牌图

- **路由**: `GET /api/og/home.png`
- **缓存**: 24 小时
- **内容**: 终端风深色背景 + 闪电前缀 + AICrash.news 大标题 + MONITORING ACTIVE

### 文章动态图

- **路由**: `GET /api/og/article.png?id=xxx`
- **缓存**: 1 小时
- **内容**: 严重度色条 + SEV 徽章 + 文章标题 + 来源/分类
- **降级**: 文章未找到时返回首页品牌图

### 依赖

`sharp` — Node.js 图像处理库，用于在服务端生成 PNG 图片。

---

## 5. Sitemap

**路由**: `GET /sitemap.xml`

- 自动从数据库查询最新 5000 篇文章
- 每个文章生成 `<url>` 条目，包含 `<lastmod>`
- 首页优先级 1.0，文章页优先级 0.8

---

## 6. 已移除

- `https://push.zhanzhang.baidu.com/push.js` — 百度站长推送脚本，CDN SSL 证书已失效，sitemap 已足够

---

## 收益总结

| 优化项 | 收益 | 实施前 | 实施后 |
|--------|------|--------|--------|
| 首页 meta 标签 | 高 | 无 description/OG | 完整 meta + OG |
| 文章页 SSR | 极高 | 空壳 HTML | 标题/摘要/正文可见 |
| canonical | 中高 | 无 | 每页规范化 URL |
| hreflang | 中 | 无 | 中英双语声明 |
| OG Image | 中 | 无预览图 | 首页品牌图 + 文章动态图 |
| JSON-LD | 中 | 无 | NewsArticle 结构化数据 |
