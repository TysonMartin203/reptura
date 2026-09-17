-- Run in Railway's MySQL "Data" console.

-- Which event types a user wants to see in their own feed (their own posts +
-- their accepted friends'). Stored as a comma-separated list of type keys
-- ('workout','pr','challenge','meal'). NULL means "show everything" — the
-- default, so existing users see no change until they open Feed Preferences.
ALTER TABLE Users ADD COLUMN feed_types VARCHAR(100) DEFAULT NULL;

-- Lets a user hide a specific friend's posts from their own feed without
-- unfriending them — the friend still shows up everywhere else (friends
-- list, leaderboard, buzzing, messages), just not in the feed.
CREATE TABLE IF NOT EXISTS FeedMutes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  muted_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (muted_user_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_feed_mute (user_id, muted_user_id)
) ENGINE=InnoDB;
