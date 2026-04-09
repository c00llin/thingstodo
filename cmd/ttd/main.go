package main

import (
	"os"

	"github.com/collinjanssen/thingstodo/internal/cli"
)

// Set via -ldflags at build time.
var (
	Version = "dev"
	Commit  = "unknown"
)

func main() {
	app := cli.NewApp(cli.Options{
		Stdout:  os.Stdout,
		Stderr:  os.Stderr,
		Env:     os.Getenv,
		HomeDir: "",
		Version: Version,
		Commit:  Commit,
	})
	os.Exit(app.Run(os.Args[1:]))
}
