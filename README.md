# AICrash.news

AI 行业负面新闻实时监控系统

## 功能特性

- 实时新闻推送（Server-Sent Events）
- 中英文双语支持
- 按严重程度筛选新闻
- 按分类、来源、时间范围过滤
- 趋势图表展示
- 响应式设计，支持移动端
- SEO 优化（新闻详情页 + Schema.org）

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MySQL
- **前端**: 原生 HTML/CSS/JavaScript
- **实时推送**: Server-Sent Events (SSE)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入数据库配置
```

### 3. 初始化数据库

```bash
mysql -u root -p < sql/init.sql
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 http://localhost:3000 启动

## 项目结构

```
aicrash/
├── public/                 # 静态文件
│   ├── components/          # 可复用组件
│   │   └── header.html     # 公共头部
│   ├── css/
│   │   └── style.css       # 样式文件
│   ├── js/
│   │   ├── app.js          # 首页主逻辑
│   │   ├── header.js       # Header 组件加载器
│   │   ├── i18n.js         # 国际化
│   │   ├── sse.js          # SSE 客户端
│   │   └── stats.js        # Header 统计
│   ├── article.html         # 新闻详情页
│   └── index.html           # 首页
├── server/                  # 后端代码
│   ├── routes/
│   │   └── news.js         # 新闻 API 路由
│   ├── db.js               # 数据库连接
│   └── index.js            # 服务器入口
├── deploy/                  # 部署文件
│   └── aicrash.service     # systemd 服务配置
├── sql/                     # 数据库脚本
│   └── init.sql            # 初始化脚本
├── .env.example             # 环境变量示例
└── package.json
```

## API 接口

### 获取新闻列表

```
GET /api/news
```

参数:
- `page` - 页码（默认 1）
- `limit` - 每页数量（默认 50）
- `lang` - 语言：zh/en
- `search` - 搜索关键词
- `source` - 来源筛选
- `category` - 分类筛选
- `severity` - 严重程度 0-5
- `start_date` / `end_date` - 发布时间范围
- `created_after` - 入库时间下限

### 获取统计数据

```
GET /api/news/stats?lang=zh
```

返回 header 展示用的全库统计（不受列表筛选影响）：

```json
{
  "total": 1234,
  "today": 56
}
```

- `total` - 当前语言下去重 URL 总数
- `today` - 当前语言下今日入库的去重 URL 数

### 获取新闻详情

```
GET /api/news/article?id=<url>
```

### 获取筛选选项

```
GET /api/news/filters?lang=zh
```

### 获取趋势数据

```
GET /api/news/trends?period=day&days=30&lang=zh
```

### 实时推送

```
GET /api/events
```

## 新闻严重程度

| 级别 | 颜色 | 说明 |
|------|------|------|
| 0 | 绿色 | 利好消息 |
| 1 | 黄色 | 轻微问题 |
| 2 | 橙色 | 中等问题 |
| 3 | 橙红 | 较严重 |
| 4 | 红色 | 严重问题 |
| 5 | 深红 | 重大危机 |

## 数据库表结构

### news 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| url | VARCHAR(512) | 新闻链接（唯一标识） |
| title | VARCHAR(512) | 标题 |
| summary | TEXT | 摘要 |
| source | VARCHAR(128) | 来源 |
| category | VARCHAR(64) | 分类 |
| severity | TINYINT | 严重程度 0-5 |
| published_at | DATETIME | 发布时间 |
| created_at | DATETIME | 入库时间 |
| lang | CHAR(2) | 语言 zh/en |

## 部署指南

### Linux + Systemd

1. 将项目复制到服务器
```bash
sudo cp -r aicrash /opt/
sudo useradd -r -s /bin/false aicrash 2>/dev/null || true
sudo chown -R aicrash:aicrash /opt/aicrash
```

2. 安装服务
```bash
sudo cp /opt/aicrash/deploy/aicrash.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable aicrash
sudo systemctl start aicrash
```

3. 配置 Nginx（参考下文）

### Nginx 配置

```nginx
server {
    listen 80;
    server_name aicrash.news www.aicrash.news;

    # SSE 支持
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

## SEO 优化

项目已实现以下 SEO 功能：

- 新闻详情页独立 URL
- Schema.org NewsArticle 结构化数据
- Open Graph / Twitter Card 支持
- 响应式设计
- 语义化 HTML

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| PORT | 否 | 3000 | 服务端口 |
| DB_HOST | 是 | - | 数据库地址 |
| DB_PORT | 否 | 3306 | 数据库端口 |
| DB_USER | 是 | - | 数据库用户名 |
| DB_PASSWORD | 是 | - | 数据库密码 |
| DB_NAME | 否 | aicrash | 数据库名 |

## License

MIT
