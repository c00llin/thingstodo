package cli

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type Options struct {
	Stdout     io.Writer
	Stderr     io.Writer
	Env        func(string) string
	HomeDir    string
	Now        func() time.Time
	HTTPClient *http.Client
	Version    string
	Commit     string
}

type App struct {
	stdout     io.Writer
	stderr     io.Writer
	env        func(string) string
	homeDir    string
	now        func() time.Time
	httpClient *http.Client
	version    string
	commit     string
}

func NewApp(opts Options) *App {
	stdout := opts.Stdout
	if stdout == nil {
		stdout = os.Stdout
	}
	stderr := opts.Stderr
	if stderr == nil {
		stderr = os.Stderr
	}
	env := opts.Env
	if env == nil {
		env = os.Getenv
	}
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	version := opts.Version
	if version == "" {
		version = "dev"
	}
	commit := opts.Commit
	if commit == "" {
		commit = "unknown"
	}
	return &App{
		stdout:     stdout,
		stderr:     stderr,
		env:        env,
		homeDir:    opts.HomeDir,
		now:        now,
		httpClient: opts.HTTPClient,
		version:    version,
		commit:     commit,
	}
}

func (a *App) Run(args []string) int {
	globals, rest, err := extractGlobalFlags(args)
	if err != nil {
		return a.fail(2, err.Error())
	}
	if len(rest) == 0 {
		return a.fail(2, a.helpText())
	}

	resolved, fileCfg, err := resolveConfig(a.homeDir, a.env, globals)
	if err != nil {
		return a.fail(2, err.Error())
	}

	switch rest[0] {
	case "version":
		_, _ = fmt.Fprintf(a.stdout, "ttd %s (%s)\n", a.version, a.commit)
		return 0
	case "config":
		return a.runConfig(rest[1:], globals, resolved, fileCfg)
	case "doctor":
		return a.runDoctor(resolved)
	}

	if resolved.URL == "" {
		return a.fail(2, "missing server URL; set --url, THINGSTODO_URL, or config url")
	}
	if resolved.APIKey == "" {
		return a.fail(2, "missing API key; set --api-key, THINGSTODO_API_KEY, or config api_key")
	}

	client := NewClient(resolved.URL, resolved.APIKey, resolved.Timeout, a.httpClient)
	ctx := context.Background()
	switch rest[0] {
	case "inbox":
		return a.runInbox(ctx, client, resolved)
	case "today":
		return a.runToday(ctx, client, resolved)
	case "upcoming":
		return a.runUpcoming(ctx, client, resolved, rest[1:])
	case "anytime":
		return a.runAnytime(ctx, client, resolved)
	case "someday":
		return a.runSomeday(ctx, client, resolved)
	case "logbook":
		return a.runLogbook(ctx, client, resolved, rest[1:])
	case "add":
		return a.runAdd(ctx, client, resolved, rest[1:])
	case "show":
		return a.runShow(ctx, client, resolved, rest[1:])
	case "search":
		return a.runSearch(ctx, client, resolved, rest[1:])
	case "edit":
		return a.runEdit(ctx, client, resolved, rest[1:])
	case "done":
		return a.runTaskMutation(ctx, client, resolved, "done", "/complete", "open", rest[1:])
	case "cancel":
		return a.runTaskMutation(ctx, client, resolved, "cancel", "/cancel", "open", rest[1:])
	case "wontdo":
		return a.runTaskMutation(ctx, client, resolved, "wontdo", "/wontdo", "open", rest[1:])
	case "reopen":
		return a.runTaskMutation(ctx, client, resolved, "reopen", "/reopen", "logbook", rest[1:])
	case "restore":
		return a.runTaskMutation(ctx, client, resolved, "restore", "/restore", "trash", rest[1:])
	case "delete":
		return a.runDelete(ctx, client, resolved, rest[1:])
	case "projects":
		return a.runProjects(ctx, client, resolved)
	case "project":
		return a.runProject(ctx, client, resolved, rest[1:])
	case "tags":
		return a.runTags(ctx, client, resolved)
	case "areas":
		return a.runAreas(ctx, client, resolved)
	default:
		return a.fail(2, fmt.Sprintf("unknown command %q", rest[0]))
	}
}

func (a *App) runConfig(args []string, globals GlobalFlags, resolved ResolvedConfig, fileCfg FileConfig) int {
	if len(args) == 0 {
		return a.fail(2, "usage: ttd config <show|set|use|doctor>")
	}
	switch args[0] {
	case "show":
		payload := map[string]any{
			"resolved": resolved,
			"file":     fileCfg,
		}
		if resolved.JSON {
			b, _ := marshalIndented(payload)
			_, _ = a.stdout.Write(append(b, '\n'))
			return 0
		}
		_, _ = fmt.Fprintf(a.stdout, "config: %s\n", resolved.ConfigPath)
		_, _ = fmt.Fprintf(a.stdout, "url: %s\n", resolved.URL)
		_, _ = fmt.Fprintf(a.stdout, "api_key: %s\n", redact(resolved.APIKey))
		if resolved.Profile != "" {
			_, _ = fmt.Fprintf(a.stdout, "profile: %s\n", resolved.Profile)
		}
		return 0
	case "set":
		if len(args) < 3 {
			return a.fail(2, "usage: ttd config set <url|api-key|output|timezone> <value>")
		}
		key, value := args[1], args[2]
		targetProfile := globals.Profile
		if targetProfile != "" {
			if fileCfg.Profiles == nil {
				fileCfg.Profiles = map[string]ProfileConfig{}
			}
			profile := fileCfg.Profiles[targetProfile]
			switch key {
			case "url":
				profile.URL = value
			case "api-key":
				profile.APIKey = value
			case "output":
				profile.Output = value
			case "timezone":
				profile.Timezone = value
			default:
				return a.fail(2, fmt.Sprintf("unsupported config key %q", key))
			}
			fileCfg.Profiles[targetProfile] = profile
		} else {
			switch key {
			case "url":
				fileCfg.URL = value
			case "api-key":
				fileCfg.APIKey = value
			case "output":
				fileCfg.Output = value
			case "timezone":
				fileCfg.Timezone = value
			default:
				return a.fail(2, fmt.Sprintf("unsupported config key %q", key))
			}
		}
		if err := writeConfigFile(resolved.ConfigPath, fileCfg); err != nil {
			return a.fail(1, err.Error())
		}
		if !resolved.Quiet {
			_, _ = fmt.Fprintf(a.stdout, "updated %s\n", resolved.ConfigPath)
		}
		return 0
	case "use":
		if len(args) < 2 {
			return a.fail(2, "usage: ttd config use <profile>")
		}
		if fileCfg.Profiles == nil {
			fileCfg.Profiles = map[string]ProfileConfig{}
		}
		if _, ok := fileCfg.Profiles[args[1]]; !ok {
			fileCfg.Profiles[args[1]] = ProfileConfig{}
		}
		fileCfg.DefaultProfile = args[1]
		if err := writeConfigFile(resolved.ConfigPath, fileCfg); err != nil {
			return a.fail(1, err.Error())
		}
		if !resolved.Quiet {
			_, _ = fmt.Fprintf(a.stdout, "default profile: %s\n", args[1])
		}
		return 0
	case "doctor":
		return a.runDoctor(resolved)
	default:
		return a.fail(2, fmt.Sprintf("unknown config command %q", args[0]))
	}
}

func (a *App) runDoctor(resolved ResolvedConfig) int {
	if resolved.URL == "" {
		return a.fail(2, "doctor requires a configured URL")
	}
	if resolved.APIKey == "" {
		return a.fail(2, "doctor requires a configured API key")
	}
	client := NewClient(resolved.URL, resolved.APIKey, resolved.Timeout, a.httpClient)
	ctx := context.Background()

	var health map[string]string
	if _, err := client.Get(ctx, "/health", nil, &health); err != nil {
		return a.renderError(err)
	}
	var auth map[string]any
	if _, err := client.Get(ctx, "/api/auth/me", nil, &auth); err != nil {
		return a.renderError(err)
	}
	if resolved.JSON {
		b, _ := marshalIndented(map[string]any{
			"health": health,
			"auth":   auth,
		})
		_, _ = a.stdout.Write(append(b, '\n'))
		return 0
	}
	_, _ = fmt.Fprintln(a.stdout, "health: ok")
	_, _ = fmt.Fprintln(a.stdout, "auth: ok")
	return 0
}

func (a *App) runInbox(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var view model.InboxView
	raw, err := client.Get(ctx, "/api/views/inbox", nil, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderInbox(view))
}

func (a *App) runToday(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var view model.TodayView
	raw, err := client.Get(ctx, "/api/views/today", nil, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderToday(view))
}

func (a *App) runUpcoming(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("upcoming", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	from := fs.String("from", "", "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	var view model.UpcomingView
	query := url.Values{}
	if *from != "" {
		query.Set("from", *from)
	}
	raw, err := client.Get(ctx, "/api/views/upcoming", query, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderUpcoming(view))
}

func (a *App) runAnytime(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var view model.AnytimeView
	raw, err := client.Get(ctx, "/api/views/anytime", nil, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderAnytime("Anytime", view))
}

func (a *App) runSomeday(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var view model.AnytimeView
	raw, err := client.Get(ctx, "/api/views/someday", nil, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderAnytime("Someday", view))
}

func (a *App) runLogbook(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("logbook", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 50, "")
	offset := fs.Int("offset", 0, "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	var view model.LogbookView
	query := url.Values{
		"limit":  {fmt.Sprintf("%d", *limit)},
		"offset": {fmt.Sprintf("%d", *offset)},
	}
	raw, err := client.Get(ctx, "/api/views/logbook", query, &view)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderLogbook("Logbook", view))
}

func (a *App) runAdd(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("add", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var tags stringList
	notes := fs.String("notes", "", "")
	when := fs.String("when", "", "")
	deadline := fs.String("deadline", "", "")
	project := fs.String("project", "", "")
	area := fs.String("area", "", "")
	heading := fs.String("heading", "", "")
	priority := fs.String("priority", "", "")
	fs.Var(&tags, "tag", "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	if fs.NArg() < 1 {
		return a.fail(2, "usage: ttd add <title>")
	}

	inline, err := parseInlineAdd(strings.Join(fs.Args(), " "), a.now())
	if err != nil {
		return a.fail(2, err.Error())
	}
	if inline.Title == "" {
		return a.fail(2, "title is required")
	}

	whenValue := inline.When
	if *when != "" {
		whenValue, err = parseDateExpression(*when, a.now())
		if err != nil {
			return a.fail(2, err.Error())
		}
	}
	var deadlineValue *string
	if *deadline != "" {
		deadlineValue, err = parseDateExpression(*deadline, a.now())
		if err != nil {
			return a.fail(2, err.Error())
		}
	}

	tagNames := append([]string{}, inline.Tags...)
	tagNames = append(tagNames, tags...)
	payload := map[string]any{
		"title": inline.Title,
		"notes": *notes,
	}
	if whenValue != nil {
		payload["when_date"] = *whenValue
	}
	if deadlineValue != nil {
		payload["deadline"] = *deadlineValue
	}
	if *priority != "" {
		switch *priority {
		case "high":
			payload["high_priority"] = true
		case "normal":
			payload["high_priority"] = false
		default:
			return a.fail(2, "priority must be high or normal")
		}
	}

	projectID, areaID, headingID, tagIDs, exitCode := a.resolveTaskRelations(ctx, client, *project, *area, *heading, "", tagNames)
	if exitCode != 0 {
		return exitCode
	}
	if projectID != nil {
		payload["project_id"] = *projectID
	}
	if areaID != nil {
		payload["area_id"] = *areaID
	}
	if headingID != nil {
		payload["heading_id"] = *headingID
	}
	if len(tagIDs) > 0 {
		payload["tag_ids"] = tagIDs
	}

	var task model.TaskDetail
	raw, err := client.Post(ctx, "/api/tasks", payload, &task)
	if err != nil {
		return a.renderError(err)
	}
	if cfg.Quiet {
		return 0
	}
	return a.writeJSONOrText(cfg, raw, renderTaskDetail(task))
}

func (a *App) runShow(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("show", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	idArg := fs.String("id", "", "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	selector := *idArg
	if selector == "" {
		if fs.NArg() < 1 {
			return a.fail(2, "usage: ttd show <task-ref>")
		}
		selector = fs.Arg(0)
	}
	id, err := resolveTaskID(ctx, client, "open", selector)
	if err != nil {
		return a.renderError(err)
	}
	var task model.TaskDetail
	raw, err := client.Get(ctx, "/api/tasks/"+id, nil, &task)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderTaskDetail(task))
}

func (a *App) runSearch(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("search", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 20, "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	if fs.NArg() < 1 {
		return a.fail(2, "usage: ttd search <query>")
	}
	var resp struct {
		Results []model.SearchResult `json:"results"`
	}
	query := url.Values{
		"q":     {strings.Join(fs.Args(), " ")},
		"limit": {fmt.Sprintf("%d", *limit)},
	}
	raw, err := client.Get(ctx, "/api/search", query, &resp)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderSearch(resp.Results))
}

func (a *App) runEdit(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("edit", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	idArg := fs.String("id", "", "")
	title := fs.String("title", "", "")
	notes := fs.String("notes", "", "")
	when := fs.String("when", "", "")
	deadline := fs.String("deadline", "", "")
	project := fs.String("project", "", "")
	area := fs.String("area", "", "")
	heading := fs.String("heading", "", "")
	clearTags := fs.Bool("clear-tags", false, "")
	priority := fs.String("priority", "", "")
	var setTags stringList
	fs.Var(&setTags, "set-tag", "")
	if err := fs.Parse(normalizeFlagArgs(args, map[string]bool{"--clear-tags": true})); err != nil {
		return a.fail(2, err.Error())
	}
	selector := *idArg
	if selector == "" {
		if fs.NArg() < 1 {
			return a.fail(2, "usage: ttd edit <task-ref> [flags]")
		}
		selector = fs.Arg(0)
	}
	id, err := resolveTaskID(ctx, client, "open", selector)
	if err != nil {
		return a.renderError(err)
	}

	var existing model.TaskDetail
	if _, err := client.Get(ctx, "/api/tasks/"+id, nil, &existing); err != nil {
		return a.renderError(err)
	}

	payload := map[string]any{}
	if *title != "" {
		payload["title"] = *title
	}
	if *notes != "" {
		payload["notes"] = *notes
	}
	if *when != "" {
		if strings.EqualFold(*when, "none") {
			payload["when_date"] = nil
		} else {
			whenValue, err := parseDateExpression(*when, a.now())
			if err != nil {
				return a.fail(2, err.Error())
			}
			payload["when_date"] = *whenValue
		}
	}
	if *deadline != "" {
		if strings.EqualFold(*deadline, "none") {
			payload["deadline"] = nil
		} else {
			deadlineValue, err := parseDateExpression(*deadline, a.now())
			if err != nil {
				return a.fail(2, err.Error())
			}
			payload["deadline"] = *deadlineValue
		}
	}
	if *priority != "" {
		switch *priority {
		case "high":
			payload["high_priority"] = true
		case "normal":
			payload["high_priority"] = false
		default:
			return a.fail(2, "priority must be high or normal")
		}
	}

	currentProjectID := ""
	if existing.Project != nil {
		currentProjectID = existing.Project.ID
	}
	projectID, areaID, headingID, tagIDs, exitCode := a.resolveTaskRelations(ctx, client, *project, *area, *heading, currentProjectID, setTags)
	if exitCode != 0 {
		return exitCode
	}
	if *project != "" {
		if strings.EqualFold(*project, "none") {
			payload["project_id"] = nil
		} else if projectID != nil {
			payload["project_id"] = *projectID
		}
	}
	if *area != "" {
		if strings.EqualFold(*area, "none") {
			payload["area_id"] = nil
		} else if areaID != nil {
			payload["area_id"] = *areaID
		}
	}
	if *heading != "" {
		if strings.EqualFold(*heading, "none") {
			payload["heading_id"] = nil
		} else if headingID != nil {
			payload["heading_id"] = *headingID
		}
	}
	if *clearTags {
		payload["tag_ids"] = []string{}
	}
	if len(setTags) > 0 {
		payload["tag_ids"] = tagIDs
	}

	var task model.TaskDetail
	raw, err := client.Patch(ctx, "/api/tasks/"+id, payload, &task)
	if err != nil {
		return a.renderError(err)
	}
	if cfg.Quiet {
		return 0
	}
	return a.writeJSONOrText(cfg, raw, renderTaskDetail(task))
}

func (a *App) runTaskMutation(ctx context.Context, client *Client, cfg ResolvedConfig, name, suffix, scope string, args []string) int {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	idArg := fs.String("id", "", "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	selector := *idArg
	if selector == "" {
		if fs.NArg() < 1 {
			return a.fail(2, fmt.Sprintf("usage: ttd %s <task-ref>", name))
		}
		selector = fs.Arg(0)
	}
	id, err := resolveTaskID(ctx, client, scope, selector)
	if err != nil {
		return a.renderError(err)
	}
	var task model.TaskDetail
	raw, err := client.Patch(ctx, "/api/tasks/"+id+suffix, map[string]any{}, &task)
	if err != nil {
		return a.renderError(err)
	}
	if cfg.Quiet {
		return 0
	}
	return a.writeJSONOrText(cfg, raw, renderTaskDetail(task))
}

func (a *App) runDelete(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	fs := flag.NewFlagSet("delete", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	idArg := fs.String("id", "", "")
	if err := fs.Parse(normalizeFlagArgs(args, nil)); err != nil {
		return a.fail(2, err.Error())
	}
	selector := *idArg
	if selector == "" {
		if fs.NArg() < 1 {
			return a.fail(2, "usage: ttd delete <task-ref>")
		}
		selector = fs.Arg(0)
	}
	id, err := resolveTaskID(ctx, client, "open", selector)
	if err != nil {
		return a.renderError(err)
	}
	if _, err := client.Delete(ctx, "/api/tasks/"+id); err != nil {
		return a.renderError(err)
	}
	if !cfg.Quiet {
		_, _ = fmt.Fprintf(a.stdout, "deleted %s\n", id)
	}
	return 0
}

func (a *App) runProjects(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var resp struct {
		Projects []model.ProjectListItem `json:"projects"`
	}
	raw, err := client.Get(ctx, "/api/projects", nil, &resp)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderProjects(resp.Projects))
}

func (a *App) runProject(ctx context.Context, client *Client, cfg ResolvedConfig, args []string) int {
	if len(args) == 0 || args[0] != "show" || len(args) < 2 {
		return a.fail(2, "usage: ttd project show <project-ref>")
	}
	var projects struct {
		Projects []model.ProjectListItem `json:"projects"`
	}
	if _, err := client.Get(ctx, "/api/projects", nil, &projects); err != nil {
		return a.renderError(err)
	}
	var refs []namedRef
	for _, project := range projects.Projects {
		refs = append(refs, namedRef{ID: project.ID, Title: project.Title})
	}
	id, err := resolveByName("project", args[1], refs)
	if err != nil {
		return a.renderError(err)
	}
	var detail model.ProjectDetail
	raw, err := client.Get(ctx, "/api/projects/"+id, nil, &detail)
	if err != nil {
		return a.renderError(err)
	}
	if cfg.JSON {
		_, _ = a.stdout.Write(append(raw, '\n'))
		return 0
	}
	_, _ = fmt.Fprintf(a.stdout, "%s\nid: %s\n", detail.Title, detail.ID)
	return 0
}

func (a *App) runTags(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var resp struct {
		Tags []model.Tag `json:"tags"`
	}
	raw, err := client.Get(ctx, "/api/tags", nil, &resp)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderTags(resp.Tags))
}

func (a *App) runAreas(ctx context.Context, client *Client, cfg ResolvedConfig) int {
	var resp struct {
		Areas []model.Area `json:"areas"`
	}
	raw, err := client.Get(ctx, "/api/areas", nil, &resp)
	if err != nil {
		return a.renderError(err)
	}
	return a.writeJSONOrText(cfg, raw, renderAreas(resp.Areas))
}

func (a *App) resolveTaskRelations(ctx context.Context, client *Client, projectRef, areaRef, headingRef, currentProjectID string, tagRefs []string) (*string, *string, *string, []string, int) {
	var projectID *string
	var areaID *string
	var headingID *string
	var tagIDs []string

	if projectRef != "" && !strings.EqualFold(projectRef, "none") {
		projects, err := listProjects(ctx, client)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		id, err := resolveByName("project", projectRef, projects)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		projectID = &id
	}
	if areaRef != "" && !strings.EqualFold(areaRef, "none") {
		areas, err := listAreas(ctx, client)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		id, err := resolveByName("area", areaRef, areas)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		areaID = &id
	}
	if headingRef != "" && !strings.EqualFold(headingRef, "none") {
		projectLookupID := currentProjectID
		if projectID != nil {
			projectLookupID = *projectID
		}
		if projectLookupID == "" {
			return nil, nil, nil, nil, a.fail(2, "heading resolution requires a project")
		}
		headings, err := listHeadings(ctx, client, projectLookupID)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		id, err := resolveByName("heading", headingRef, headings)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		headingID = &id
	}
	if len(tagRefs) > 0 {
		tags, err := listTags(ctx, client)
		if err != nil {
			return nil, nil, nil, nil, a.renderError(err)
		}
		for _, tagRef := range tagRefs {
			id, err := resolveByName("tag", tagRef, tags)
			if err != nil {
				if errors.Is(err, ErrNotFound) {
					return nil, nil, nil, nil, a.fail(2, fmt.Sprintf("unknown tag %q", tagRef))
				}
				return nil, nil, nil, nil, a.renderError(err)
			}
			tagIDs = append(tagIDs, id)
		}
	}
	return projectID, areaID, headingID, tagIDs, 0
}

func listProjects(ctx context.Context, client *Client) ([]namedRef, error) {
	var resp struct {
		Projects []model.ProjectListItem `json:"projects"`
	}
	if _, err := client.Get(ctx, "/api/projects", nil, &resp); err != nil {
		return nil, err
	}
	refs := make([]namedRef, 0, len(resp.Projects))
	for _, project := range resp.Projects {
		refs = append(refs, namedRef{ID: project.ID, Title: project.Title})
	}
	return refs, nil
}

func listAreas(ctx context.Context, client *Client) ([]namedRef, error) {
	var resp struct {
		Areas []model.Area `json:"areas"`
	}
	if _, err := client.Get(ctx, "/api/areas", nil, &resp); err != nil {
		return nil, err
	}
	refs := make([]namedRef, 0, len(resp.Areas))
	for _, area := range resp.Areas {
		refs = append(refs, namedRef{ID: area.ID, Title: area.Title})
	}
	return refs, nil
}

func listTags(ctx context.Context, client *Client) ([]namedRef, error) {
	var resp struct {
		Tags []model.Tag `json:"tags"`
	}
	if _, err := client.Get(ctx, "/api/tags", nil, &resp); err != nil {
		return nil, err
	}
	refs := make([]namedRef, 0, len(resp.Tags))
	for _, tag := range resp.Tags {
		refs = append(refs, namedRef{ID: tag.ID, Title: tag.Title})
	}
	return refs, nil
}

func listHeadings(ctx context.Context, client *Client, projectID string) ([]namedRef, error) {
	var resp struct {
		Headings []model.Heading `json:"headings"`
	}
	if _, err := client.Get(ctx, "/api/projects/"+projectID+"/headings", nil, &resp); err != nil {
		return nil, err
	}
	refs := make([]namedRef, 0, len(resp.Headings))
	for _, heading := range resp.Headings {
		refs = append(refs, namedRef{ID: heading.ID, Title: heading.Title})
	}
	return refs, nil
}

func (a *App) writeJSONOrText(cfg ResolvedConfig, raw []byte, text string) int {
	if cfg.JSON {
		_, _ = a.stdout.Write(append(raw, '\n'))
		return 0
	}
	var buf bytes.Buffer
	writeOutput(&buf, text)
	_, _ = a.stdout.Write(buf.Bytes())
	return 0
}

func (a *App) renderError(err error) int {
	code := 1
	switch {
	case errors.Is(err, ErrNotFound):
		code = 4
	case isAmbiguous(err):
		code = 3
	case isUsageError(err):
		code = 2
	default:
		var apiErr *APIError
		if errors.As(err, &apiErr) {
			switch apiErr.Status {
			case http.StatusUnauthorized, http.StatusForbidden:
				code = 5
			case http.StatusNotFound:
				code = 4
			case http.StatusBadRequest, http.StatusConflict:
				code = 2
			default:
				code = 1
			}
		} else {
			var netErr net.Error
			if errors.As(err, &netErr) {
				code = 6
			}
			var urlErr *url.Error
			if errors.As(err, &urlErr) {
				code = 6
			}
		}
	}

	var message string
	if ambiguous, ok := err.(*AmbiguousError); ok {
		var lines []string
		lines = append(lines, fmt.Sprintf("error: ambiguous %s reference %q", ambiguous.Kind, ambiguous.Input))
		lines = append(lines, "matches:")
		for i, match := range ambiguous.Matches {
			lines = append(lines, fmt.Sprintf("  %d. %s", i+1, match))
		}
		message = strings.Join(lines, "\n")
	} else if errors.Is(err, ErrNotFound) {
		message = "error: not found"
	} else {
		message = "error: " + err.Error()
	}
	return a.fail(code, message)
}

func (a *App) fail(code int, message string) int {
	if message != "" {
		_, _ = fmt.Fprintln(a.stderr, message)
	}
	return code
}

func isAmbiguous(err error) bool {
	var ambiguous *AmbiguousError
	return errors.As(err, &ambiguous)
}

func isUsageError(err error) bool {
	return false
}

func extractGlobalFlags(args []string) (GlobalFlags, []string, error) {
	var globals GlobalFlags
	var rest []string
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--json":
			globals.JSON = true
		case arg == "--no-color":
			globals.NoColor = true
		case arg == "--quiet":
			globals.Quiet = true
		case arg == "--url":
			i++
			if i >= len(args) {
				return globals, nil, fmt.Errorf("missing value for --url")
			}
			globals.URL = args[i]
		case strings.HasPrefix(arg, "--url="):
			globals.URL = strings.TrimPrefix(arg, "--url=")
		case arg == "--api-key":
			i++
			if i >= len(args) {
				return globals, nil, fmt.Errorf("missing value for --api-key")
			}
			globals.APIKey = args[i]
		case strings.HasPrefix(arg, "--api-key="):
			globals.APIKey = strings.TrimPrefix(arg, "--api-key=")
		case arg == "--timeout":
			i++
			if i >= len(args) {
				return globals, nil, fmt.Errorf("missing value for --timeout")
			}
			globals.Timeout = args[i]
		case strings.HasPrefix(arg, "--timeout="):
			globals.Timeout = strings.TrimPrefix(arg, "--timeout=")
		case arg == "--profile":
			i++
			if i >= len(args) {
				return globals, nil, fmt.Errorf("missing value for --profile")
			}
			globals.Profile = args[i]
		case strings.HasPrefix(arg, "--profile="):
			globals.Profile = strings.TrimPrefix(arg, "--profile=")
		default:
			rest = append(rest, arg)
		}
	}
	return globals, rest, nil
}

func (a *App) helpText() string {
	return strings.TrimSpace(`
usage: ttd [global flags] <command>

commands:
  inbox
  today
  upcoming
  anytime
  someday
  logbook
  add
  show
  search
  edit
  done
  reopen
  cancel
  wontdo
  delete
  restore
  projects
  project show
  tags
  areas
  version
  doctor
  config
`)
}

func redact(v string) string {
	if v == "" {
		return ""
	}
	if len(v) <= 4 {
		return "****"
	}
	return strings.Repeat("*", len(v)-4) + v[len(v)-4:]
}

type stringList []string

func (s *stringList) String() string {
	return strings.Join(*s, ",")
}

func (s *stringList) Set(value string) error {
	*s = append(*s, value)
	return nil
}

func sortMatches(in []string) []string {
	out := append([]string{}, in...)
	sort.Strings(out)
	return out
}

func normalizeFlagArgs(args []string, boolFlags map[string]bool) []string {
	var flags []string
	var positionals []string
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if strings.HasPrefix(arg, "-") {
			flags = append(flags, arg)
			if strings.Contains(arg, "=") || boolFlags[arg] {
				continue
			}
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				flags = append(flags, args[i+1])
				i++
			}
			continue
		}
		positionals = append(positionals, arg)
	}
	return append(flags, positionals...)
}
