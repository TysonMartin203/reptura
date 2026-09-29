-- v26 — Premium. Run each statement on its own in Railway's MySQL Data → Query
-- box. "Duplicate column name" means that step is already done — skip it.

ALTER TABLE Users ADD COLUMN premium_until DATETIME NULL;

ALTER TABLE Crews ADD COLUMN auto_join TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE Crews ADD COLUMN grants_premium TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS AiUsage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  feature VARCHAR(30) NOT NULL,
  used_at DATETIME NOT NULL,
  INDEX idx_aiusage_user_feature_time (user_id, feature, used_at),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO Crews (name, created_by, auto_join, grants_premium)
SELECT 'Alpha Testers', (SELECT id FROM Users ORDER BY is_admin DESC, id ASC LIMIT 1), 1, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM (SELECT id FROM Crews WHERE name = 'Alpha Testers') AS x);

UPDATE Crews SET grants_premium = 1, auto_join = 1 WHERE name = 'Alpha Testers';

INSERT IGNORE INTO CrewMembers (crew_id, user_id)
SELECT c.id, u.id FROM Crews c CROSS JOIN Users u WHERE c.name = 'Alpha Testers';
