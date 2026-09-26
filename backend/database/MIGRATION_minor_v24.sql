-- v24
-- Run in Railway's MySQL "Data" console.
--
-- Marks a lifting exercise as bodyweight, so its personal record is tracked as
-- most reps rather than heaviest weight. Set explicitly by the user with the
-- "Bodyweight" checkbox when logging.
--
-- Guarded so it's safe to run even if it was applied before — a plain ALTER
-- would fail with "Duplicate column name" and abort the rest of a batch.

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WorkoutExercises'
    AND COLUMN_NAME = 'bodyweight'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE WorkoutExercises ADD COLUMN bodyweight TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT "bodyweight column already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
