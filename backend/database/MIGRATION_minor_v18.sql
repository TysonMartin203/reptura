-- Run in Railway's MySQL "Data" console.

-- Lets a user turn off notifications for reactions on their feed posts.
-- Defaults to on, matching how notify_buzz and notify_messages both default.
ALTER TABLE Users ADD COLUMN notify_reactions TINYINT(1) NOT NULL DEFAULT 1;
