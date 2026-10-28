-- ═════════════════════════════════════════════════════════════
-- Migration 002: Users table for JWT Authentication
-- Run: mysql -u root -p campus_energy < migrations/002_add_users.sql
-- ═════════════════════════════════════════════════════════════
USE campus_energy;

CREATE TABLE IF NOT EXISTS users (
    id            INT          NOT NULL AUTO_INCREMENT,
    username      VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Login handle',
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    role          ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer'
                      COMMENT 'admin = full access; viewer = read-only analytics',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_login    DATETIME     NULL,
    PRIMARY KEY   (id),
    INDEX         idx_username (username),
    INDEX         idx_role     (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Application users for JWT-based authentication';

-- ── Seed default admin (password: Admin@123) ──────────────────
-- Hash generated with: python -c "from flask_bcrypt import Bcrypt; b=Bcrypt(); print(b.generate_password_hash('Admin@123').decode())"
-- NOTE: Change this password immediately in any non-development environment.
INSERT INTO users (username, email, password_hash, role) VALUES
(
    'admin',
    'admin@campus.edu',
    '$2b$12$placeholder_admin_hash_replace_at_runtime',
    'admin'
)
ON DUPLICATE KEY UPDATE username = username;  -- no-op if already exists

-- ── Seed default viewer (password: Viewer@123) ────────────────
INSERT INTO users (username, email, password_hash, role) VALUES
(
    'viewer',
    'viewer@campus.edu',
    '$2b$12$placeholder_viewer_hash_replace_at_runtime',
    'viewer'
)
ON DUPLICATE KEY UPDATE username = username;

-- ── Note on placeholder hashes ────────────────────────────────
-- The Flask app auto-seeds real bcrypt hashes on first startup via
-- app/auth/seed.py.  These placeholder rows are overwritten safely.
