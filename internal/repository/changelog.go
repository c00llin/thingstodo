package repository

import (
	"database/sql"
)

// ChangeLogEntry represents a single entry in the change_log table.
type ChangeLogEntry struct {
	Seq       int64   `json:"seq"`
	Entity    string  `json:"entity"`
	EntityID  string  `json:"entity_id"`
	Action    string  `json:"action"`
	Fields    *string `json:"fields,omitempty"`
	Snapshot  string  `json:"snapshot"`
	UserID    string  `json:"user_id,omitempty"`
	DeviceID  string  `json:"device_id,omitempty"`
	CreatedAt string  `json:"created_at"`
}

// ChangeLogRepository provides access to the change_log table.
type ChangeLogRepository struct {
	db *sql.DB
}

// NewChangeLogRepository creates a new ChangeLogRepository.
func NewChangeLogRepository(db *sql.DB) *ChangeLogRepository {
	return &ChangeLogRepository{db: db}
}

// AppendChange inserts a new entry into the change log and returns its seq.
func (r *ChangeLogRepository) AppendChange(entity, entityID, action string, fields *string, snapshot, userID, deviceID string) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO change_log (entity, entity_id, action, fields, snapshot, user_id, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		entity, entityID, action, fields, snapshot, nullableString(userID), nullableString(deviceID),
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// GetChangesSince returns entries with seq > sinceSeq, ordered by seq ASC, up to limit entries.
func (r *ChangeLogRepository) GetChangesSince(sinceSeq int64, limit int) ([]ChangeLogEntry, error) {
	rows, err := r.db.Query(
		`SELECT seq, entity, entity_id, action, fields, snapshot, COALESCE(user_id, ''), COALESCE(device_id, ''), created_at
		 FROM change_log
		 WHERE seq > ?
		 ORDER BY seq ASC
		 LIMIT ?`,
		sinceSeq, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ChangeLogEntry
	for rows.Next() {
		var e ChangeLogEntry
		if err := rows.Scan(&e.Seq, &e.Entity, &e.EntityID, &e.Action, &e.Fields, &e.Snapshot, &e.UserID, &e.DeviceID, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []ChangeLogEntry{}
	}
	return entries, nil
}

// GetLatestSeq returns the highest seq in the change log, or 0 if the table is empty.
func (r *ChangeLogRepository) GetLatestSeq() (int64, error) {
	var seq sql.NullInt64
	err := r.db.QueryRow(`SELECT MAX(seq) FROM change_log`).Scan(&seq)
	if err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 0, nil
	}
	return seq.Int64, nil
}

// GetOldestSeq returns the lowest seq in the change log, or 0 if the table is empty.
func (r *ChangeLogRepository) GetOldestSeq() (int64, error) {
	var seq sql.NullInt64
	err := r.db.QueryRow(`SELECT MIN(seq) FROM change_log`).Scan(&seq)
	if err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 0, nil
	}
	return seq.Int64, nil
}

// PurgeOlderThan deletes entries older than the given number of days and returns the count deleted.
func (r *ChangeLogRepository) PurgeOlderThan(days int) (int64, error) {
	result, err := r.db.Exec(
		`DELETE FROM change_log WHERE created_at < datetime('now', ? || ' days')`,
		-days,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// nullableString converts an empty string to nil for nullable SQL columns.
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
