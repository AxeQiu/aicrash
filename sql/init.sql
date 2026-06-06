CREATE DATABASE IF NOT EXISTS aicrash
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aicrash;

CREATE TABLE IF NOT EXISTS news (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(1000) NOT NULL,
  lang CHAR(2) NOT NULL DEFAULT 'zh' COMMENT 'zh=en',
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  severity TINYINT UNSIGNED DEFAULT 1 COMMENT '0=利好, 1-5=负面程度(5最严重)',
  view_count INT UNSIGNED DEFAULT 0 COMMENT '查看次数',
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_published_at (published_at DESC),
  INDEX idx_category (category),
  INDEX idx_source (source),
  INDEX idx_severity (severity),
  INDEX idx_lang (lang),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_url_lang (url(255), lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
