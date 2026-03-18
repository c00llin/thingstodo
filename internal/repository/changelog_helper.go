package repository

import "encoding/json"

// logChange is a convenience wrapper used by all repositories to record a mutation.
// It is nil-safe: if cl is nil (e.g., in tests), the call is a no-op.
func logChange(cl *ChangeLogRepository, entity, entityID, action string, fields []string, snapshot interface{}, userID, deviceID string) {
	if cl == nil {
		return
	}
	data, err := json.Marshal(snapshot)
	if err != nil {
		return // best-effort logging
	}
	var fieldsJSON *string
	if fields != nil {
		f, _ := json.Marshal(fields)
		s := string(f)
		fieldsJSON = &s
	}
	_, _ = cl.AppendChange(entity, entityID, action, fieldsJSON, string(data), userID, deviceID)
}
