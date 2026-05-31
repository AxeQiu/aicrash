# 贡献指南

## 开发环境

1. 克隆项目
```bash
git clone <repository-url>
cd aicrash
```

2. 安装依赖
```bash
npm install
```

3. 复制环境变量
```bash
cp .env.example .env
# 编辑 .env 填入本地数据库配置
```

4. 初始化数据库
```bash
mysql -u root -p < sql/init.sql
```

5. 启动开发服务器
```bash
npm run dev
```

## 代码规范

- 使用 2 空格缩进
- 变量命名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 注释使用中文或英文，保持一致

## 分支管理

- `main` - 主分支，用于发布
- `develop` - 开发分支
- `feature/*` - 功能分支
- `fix/*` - 修复分支

## 提交信息

格式：`[type] subject`

type:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化

示例：
```
[feat] 添加新闻详情页
[fix] 修复 SSE 连接断开问题
[docs] 更新 README
```

## Pull Request

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到远程
5. 创建 Pull Request

## 数据库迁移

修改 `sql/init.sql` 后，请同步更新本地的开发数据库。
