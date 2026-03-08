ALTER TABLE user_settings ADD COLUMN notification_provider TEXT NOT NULL DEFAULT 'webpush';
ALTER TABLE user_settings ADD COLUMN ntfy_server_url TEXT NOT NULL DEFAULT 'https://ntfy.sh';
ALTER TABLE user_settings ADD COLUMN ntfy_topic TEXT NOT NULL DEFAULT 'thingstodo';
ALTER TABLE user_settings ADD COLUMN ntfy_access_token TEXT NOT NULL DEFAULT '';
ALTER TABLE user_settings ADD COLUMN base_url TEXT NOT NULL DEFAULT '';
