-- Run in Railway's MySQL "Data" console.

-- NULL means unread; a timestamp means read at that time. Lets the Friends
-- list show a little indicator next to anyone who's sent a message you
-- haven't opened yet.
ALTER TABLE Messages ADD COLUMN read_at DATETIME NULL;
