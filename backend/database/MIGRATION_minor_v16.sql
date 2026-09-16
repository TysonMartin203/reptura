-- Run in Railway's MySQL "Data" console.

-- Lets a progress photo be tagged (e.g. "bicep", "quads") so photos can later
-- be filtered by muscle group to see progression in just that area, while
-- still keeping the full untagged gallery view available too.
ALTER TABLE ProgressPhotos ADD COLUMN tags JSON NULL;
