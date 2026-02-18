package repository

import "fmt"

var ErrDuplicateProjectName = fmt.Errorf("duplicate project name")
var ErrDuplicateAreaName = fmt.Errorf("duplicate area name")
var ErrDuplicateTagName = fmt.Errorf("duplicate tag name")
