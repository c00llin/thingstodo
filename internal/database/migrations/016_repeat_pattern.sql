-- Add pattern column for rich recurrence patterns (JSON)
ALTER TABLE repeat_rules ADD COLUMN pattern TEXT NOT NULL DEFAULT '';

-- Backfill existing rules: convert flat columns to JSON pattern objects
-- daily → {"type":"daily","every":N,"mode":"..."}
UPDATE repeat_rules SET pattern = json_object(
    'type', 'daily',
    'every', interval_value,
    'mode', mode
) WHERE frequency = 'daily';

-- weekly → {"type":"weekly","every":N,"mode":"...","on":[...]}
UPDATE repeat_rules SET pattern = json_object(
    'type', 'weekly',
    'every', interval_value,
    'mode', mode,
    'on', json(CASE WHEN day_constraints = '' THEN '[]' ELSE day_constraints END)
) WHERE frequency = 'weekly';

-- monthly → {"type":"monthly_dom","every":N,"mode":"..."}
UPDATE repeat_rules SET pattern = json_object(
    'type', 'monthly_dom',
    'every', interval_value,
    'mode', mode
) WHERE frequency = 'monthly';

-- yearly → {"type":"yearly_date","every":N,"mode":"..."}
UPDATE repeat_rules SET pattern = json_object(
    'type', 'yearly_date',
    'every', interval_value,
    'mode', mode
) WHERE frequency = 'yearly';
