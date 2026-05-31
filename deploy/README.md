# 部署指南

## 服务器要求

- Ubuntu 20.04+ / Debian 11+
- Node.js 18+
- MySQL 8.0+
- Nginx
- 域名（可选，用于 HTTPS）

## 步骤 1：安装依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 MySQL
sudo apt install -y mysql-server

# 安装 Nginx
sudo apt install -y nginx

# 验证安装
node --version
mysql --version
nginx -v
```

## 步骤 2：创建数据库

```bash
sudo mysql
```

```sql
CREATE DATABASE aicrash CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aicrash'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON aicrash.* TO 'aicrash'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 步骤 3：部署应用

```bash
# 创建部署目录
sudo mkdir -p /opt/aicrash
sudo chown $USER:$USER /opt/aicrash

# 复制项目文件
rsync -av --exclude='node_modules' --exclude='.env' /path/to/local/aicrash/ /opt/aicrash/

# 安装依赖
cd /opt/aicrash
npm install --production

# 创建环境变量文件
sudo cp /opt/aicrash/.env.example /opt/aicrash/.env
sudo nano /opt/aicrash/.env
# 编辑数据库配置
```

## 步骤 4：配置 systemd 服务

```bash
sudo cp /opt/aicrash/deploy/aicrash.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable aicrash
sudo systemctl start aicrash
sudo systemctl status aicrash
```

## 步骤 5：配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/aicrash
```

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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

```bash
sudo ln -s /etc/nginx/sites-available/aicrash /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 步骤 6：配置防火墙

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 步骤 7：配置 HTTPS（可选，推荐）

使用 Let's Encrypt 免费证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aicrash.news -d www.aicrash.news
```

## 步骤 8：验证部署

```bash
# 检查服务状态
sudo systemctl status aicrash

# 检查端口监听
sudo ss -tlnp | grep 3000

# 查看日志
sudo journalctl -u aicrash -f

# 测试 API
curl http://localhost:3000/api/news
```

## 常用命令

```bash
# 启动服务
sudo systemctl start aicrash

# 停止服务
sudo systemctl stop aicrash

# 重启服务
sudo systemctl restart aicrash

# 查看日志
sudo journalctl -u aicrash -n 100

# 更新部署
cd /opt/aicrash
git pull
npm install
sudo systemctl restart aicrash
```

## 故障排查

### 服务无法启动
```bash
sudo journalctl -u aicrash -n 50
# 检查数据库连接和 .env 配置
```

### 502 Bad Gateway
```bash
# 检查 aicrash 服务是否运行
sudo systemctl status aicrash

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 数据库连接失败
```bash
# 测试数据库连接
mysql -u aicrash -p -h localhost aicrash
```
