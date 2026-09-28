-- v26 — Premium
-- Run in Railway's MySQL "Data" console.
--
-- 1. Users.premium_until — premium granted directly (admin grant now; a paid
--    subscription later would set the same column). NULL = not granted.
-- 2. Crews.grants_premium — every member of such a crew is premium for as long
--    as they're in it. Alpha Testers gets this.
-- 3. AiUsage — one row per successful major AI generation, used to count free
--    generations for non-premium accounts each month.
-- 4. Makes sure the Alpha Testers crew exists and every current user is in it
--    (repeats v25's work, so this file stands on its own even if v25 was skipped).
--
-- Every step is guarded, so running this twice is harmless.

-- ── helper pattern: add a column only if it's missing ───────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'premium_until');
SET @s := IF(@c = 0, 'ALTER TABLE Users ADD COLUMN premium_until DATETIME NULL', 'SELECT "Users.premium_until exists"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Crews' AND COLUMN_NAME = 'auto_join');
SET @s := IF(@c = 0, 'ALTER TABLE Crews ADD COLUMN auto_join TINYINT(1) NOT NULL DEFAULT 0', 'SELECT "Crews.auto_join exists"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Crews' AND COLUMN_NAME = 'grants_premium');
SET @s := IF(@c = 0, 'ALTER TABLE Crews ADD COLUMN grants_premium TINYINT(1) NOT NULL DEFAULT 0', 'SELECT "Crews.grants_premium exists"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── usage log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS AiUsage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  feature VARCHAR(30) NOT NULL,
  used_at DATETIME NOT NULL,
  INDEX idx_aiusage_user_feature_time (user_id, feature, used_at),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Alpha Testers: exists, auto-joins, grants premium ───────────────────────
INSERT INTO Crews (name, created_by, auto_join, grants_premium)
SELECT 'Alpha Testers',
       (SELECT id FROM Users ORDER BY is_admin DESC, id ASC LIMIT 1),
       1, 1
FROM DUAL
WHERE EXISTS (SELECT 1 FROM Users)
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM Crews WHERE name = 'Alpha Testers') AS existing);

UPDATE Crews SET grants_premium = 1, auto_join = 1 WHERE name = 'Alpha Testers';

-- ── every current account joins ─────────────────────────────────────────────
INSERT IGNORE INTO CrewMembers (crew_id, user_id)
SELECT c.id, u.id
FROM Crews c CROSS JOIN Users u
WHERE c.name = 'Alpha Testers';

-- Check: members should equal the number of users.
-- SELECT (SELECT COUNT(*) FROM Users) AS users,
--        (SELECT COUNT(*) FROM CrewMembers m JOIN Crews c ON c.id = m.crew_id
--         WHERE c.name = 'Alpha Testers') AS alpha_members;
