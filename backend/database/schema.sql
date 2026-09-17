CREATE DATABASE IF NOT EXISTS workout_tracker;
USE workout_tracker;

CREATE TABLE IF NOT EXISTS Users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    VARCHAR(255) DEFAULT NULL,
  feed_types    VARCHAR(100) DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Workouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  notes_before TEXT NULL,
  notes_after TEXT NULL,
  photo_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WorkoutExercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workout_id INT NOT NULL,
  category ENUM('lifting','cardio') NOT NULL,
  exercise_name VARCHAR(100) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  sets INT NULL,
  reps INT NULL,
  weight DECIMAL(6,2) NULL,
  per_set_weights TINYINT(1) NOT NULL DEFAULT 0,
  duration_minutes DECIMAL(6,2) NULL,
  distance DECIMAL(6,2) NULL,
  distance_unit VARCHAR(10) NULL,
  calories INT NULL,
  avg_heart_rate INT NULL,
  pace VARCHAR(30) NULL,
  FOREIGN KEY (workout_id) REFERENCES Workouts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS WorkoutSets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workout_exercise_id INT NOT NULL,
  set_number INT NOT NULL,
  reps INT NULL,
  weight DECIMAL(6,2) NULL,
  FOREIGN KEY (workout_exercise_id) REFERENCES WorkoutExercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PRs (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, exercise VARCHAR(100) NOT NULL,
  max_weight DECIMAL(6,2) NOT NULL, achieved_on DATE NOT NULL,
  workout_id INT NULL, workout_exercise_id INT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES Workouts(id) ON DELETE SET NULL,
  UNIQUE KEY uq_pr_user_exercise (user_id, exercise)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ProgressPhotos (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, file_path VARCHAR(255) NOT NULL,
  photo_date DATE NOT NULL, workout_id INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES Workouts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Friends (
  id INT AUTO_INCREMENT PRIMARY KEY, requester_id INT NOT NULL, receiver_id INT NOT NULL,
  status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id)  REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_friends (requester_id, receiver_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FeedMutes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  muted_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (muted_user_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_feed_mute (user_id, muted_user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Messages (
  id INT AUTO_INCREMENT PRIMARY KEY, sender_id INT NOT NULL, receiver_id INT NOT NULL,
  message TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Was previously only ever lazy-created by the app on first use (meal.controller.js's
-- ensureTable()) rather than defined here — added so a fresh install has it from the start.
CREATE TABLE IF NOT EXISTS MealPlans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT 'My Meal Plan',
  profile JSON,
  plan JSON,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_meal_user (user_id)
) ENGINE=InnoDB;
