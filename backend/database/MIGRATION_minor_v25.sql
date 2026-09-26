-- v25
-- 1. Crews that every account joins automatically.
-- 2. The "Alpha Testers" crew, with every existing user in it.
--
-- Safe to run more than once: the column add is guarded, the crew is only
-- created if it isn't there, and the member backfill uses INSERT IGNORE against
-- the (crew_id, user_id) primary key.

-- ── 1. auto_join flag ───────────────────────────────────────────────────────
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Crews' AND COLUMN_NAME = 'auto_join'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE Crews ADD COLUMN auto_join TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT "auto_join already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. The crew itself ──────────────────────────────────────────────────────
-- Owned by an admin if there is one, otherwise the oldest account. The owner is
-- the only person who can delete it from the app.
INSERT INTO Crews (name, created_by, auto_join)
SELECT 'Alpha Testers',
       (SELECT id FROM Users ORDER BY is_admin DESC, id ASC LIMIT 1),
       1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM Users)
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT id FROM Crews WHERE name = 'Alpha Testers') AS existing
  );

-- ── 3. Everyone currently on the app joins ──────────────────────────────────
INSERT IGNORE INTO CrewMembers (crew_id, user_id)
SELECT c.id, u.id
FROM Crews c
CROSS JOIN Users u
WHERE c.auto_join = 1;

-- Check: should list every user once.
-- SELECT c.name, COUNT(*) AS members
-- FROM Crews c JOIN CrewMembers m ON m.crew_id = c.id
-- WHERE c.name = 'Alpha Testers' GROUP BY c.id;
