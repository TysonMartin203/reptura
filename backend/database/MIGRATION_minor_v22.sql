-- Run in Railway's MySQL "Data" console.

-- Stores each user's own Kroger OAuth tokens (needed to add items to THEIR
-- cart — Kroger's Cart API only works with a token the user personally
-- authorized, unlike Instacart's link-based approach) plus their chosen
-- store location for product search.
CREATE TABLE IF NOT EXISTS KrogerAuth (
  user_id INT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  location_id VARCHAR(20) DEFAULT NULL,
  location_name VARCHAR(200) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
