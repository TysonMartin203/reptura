-- v27 — unfinished workout drafts (one per user).
-- Run in Railway's MySQL Data → Query box.
CREATE TABLE IF NOT EXISTS WorkoutDrafts (
  user_id INT NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
