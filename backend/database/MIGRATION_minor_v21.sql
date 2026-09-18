-- Run in Railway's MySQL "Data" console.

-- Family members a user can plan meals around — reusable across generations
-- rather than re-entered every time.
CREATE TABLE IF NOT EXISTS FamilyMembers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT DEFAULT NULL,
  weight DECIMAL(6,1) DEFAULT NULL,
  goal VARCHAR(50) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Lets a generated plan be tagged into a browsable category (e.g. "Family
-- Plan") the same way template plans already are — NULL for an ordinary
-- plan with no category.
ALTER TABLE MealPlans ADD COLUMN category VARCHAR(50) DEFAULT NULL;
