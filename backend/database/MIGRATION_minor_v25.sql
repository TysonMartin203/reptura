-- v25 — Alpha Testers crew. Everything here is also in v26, so if you've run
-- v26 you can skip this file. Run each statement on its own in Railway's
-- MySQL Data → Query box. "Duplicate column name" means that step is done.

ALTER TABLE Crews ADD COLUMN auto_join TINYINT(1) NOT NULL DEFAULT 0;

INSERT INTO Crews (name, created_by, auto_join)
SELECT 'Alpha Testers', (SELECT id FROM Users ORDER BY is_admin DESC, id ASC LIMIT 1), 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM (SELECT id FROM Crews WHERE name = 'Alpha Testers') AS x);

INSERT IGNORE INTO CrewMembers (crew_id, user_id)
SELECT c.id, u.id FROM Crews c CROSS JOIN Users u WHERE c.name = 'Alpha Testers';
