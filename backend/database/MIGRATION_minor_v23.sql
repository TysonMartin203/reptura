-- Run in Railway's MySQL "Data" console.

-- Long-term race training plans (5K through Ironman). Kept separate from
-- WorkoutPlans because the shape is different: many weeks leading up to a
-- fixed race date, rather than one repeating week.
CREATE TABLE IF NOT EXISTS RaceTrainingPlans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  race_type VARCHAR(50) NOT NULL,
  race_name VARCHAR(150) DEFAULT NULL,
  race_date DATE NOT NULL,
  start_date DATE NOT NULL,
  inputs JSON DEFAULT NULL,
  plan JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
