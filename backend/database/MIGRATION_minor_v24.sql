-- v24 — Bodyweight checkbox. Run in Railway's MySQL Data → Query box.
-- If it says "Duplicate column name", it's already been run — nothing to do.
ALTER TABLE WorkoutExercises ADD COLUMN bodyweight TINYINT(1) NOT NULL DEFAULT 0;
