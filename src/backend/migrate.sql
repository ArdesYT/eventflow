-- ── EventFlow DB Migration ────────────────────────────────────────────────────
-- Run this once in phpMyAdmin or via: mysql -u root eventflow < migrate.sql

-- 1. Add color column to sessions (if it doesn't exist)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS color VARCHAR(10) NOT NULL DEFAULT 'blue';

-- 2. Add role column to users (if it doesn't exist)  
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'attendee';

-- 3. Seed two demo users (booker + attendee)
--    Passwords are bcrypt hashes of 'booker123' and 'attendee123'
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
  ('Anna Kovács', 'booker@eventflow.hu',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'booker'),
  ('Péter Nagy', 'attendee@eventflow.hu',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'attendee');

-- Note: the hash above is bcrypt('password') — a placeholder.
-- Generate real hashes with: node -e "require('bcrypt').hash('booker123',10).then(console.log)"
-- Then UPDATE users SET password_hash='<hash>' WHERE email='booker@eventflow.hu';
