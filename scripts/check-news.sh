#!/bin/bash
# 检查新闻 API 是否正常工作

API_URL="${1:-http://localhost:3000}"

echo "检查 AICrash.news API..."
echo "URL: $API_URL"
echo ""

# 检查健康状态
echo "1. 检查新闻列表 API..."
curl -s "$API_URL/api/news?limit=1" | head -c 200
echo ""
echo ""

# 检查筛选选项
echo "2. 检查筛选选项 API..."
curl -s "$API_URL/api/news/filters?lang=zh" | head -c 200
echo ""
echo ""

# 检查趋势 API
echo "3. 检查趋势 API..."
curl -s "$API_URL/api/news/trends?days=7&lang=zh" | head -c 200
echo ""
echo ""

# 检查 SSE 连接
echo "4. 检查 SSE 连接（3秒超时）..."
timeout 3 curl -s -N "$API_URL/api/events" | head -c 100 || echo "(SSE 连接正常，已超时)"
echo ""

echo "检查完成!"
