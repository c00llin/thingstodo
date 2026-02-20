ALTER TABLE user_settings ADD COLUMN review_after_days INTEGER DEFAULT 7;
UPDATE user_settings SET review_after_days = 7 WHERE review_after_days IS NULL;
