-- Run in Railway's MySQL "Data" console.

-- Adjustable notification preferences for friend requests and train-together
-- invites — matches the pattern of notify_buzz / notify_messages / notify_reactions.
ALTER TABLE Users ADD COLUMN notify_friend_requests TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE Users ADD COLUMN notify_invites TINYINT(1) NOT NULL DEFAULT 1;
