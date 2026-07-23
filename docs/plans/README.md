# docs/plans/

Interactive, self-contained HTML plan/decision pages — one file each,
offline-ready, approve/reject/edit-able, numbered per repo.

## Browse

```bash
bun run plans            # interactive picker (fzf if installed, else numbered)
bun run plans latest     # open the newest plan (highest #seq)
bun run plans <substr>   # open first plan whose filename matches <substr>
open docs/plans/index.html   # dashboard (auto-regenerated each session)
```

(No `package.json`? Use `node scripts/plans.mjs …` or the global `claude-plans`
command — same behavior.)

## Create

```bash
bun run plans new <slug> --title "Title" --source "where this came from"
```

Stamps `YYYY-MM-DD-NNN-<slug>.html` from `.plan-template.html` with the next
sequence number and this repo's accent color, then rebuilds the dashboard.
Fill in the thesis paragraph and `PLAN_ITEMS` (see `DESIGN.md`).

## App skeleton (default app template)

```bash
bun run plans app <slug> [--title "Title"] [--badge "TAG"] [--dest dir] [--template name]
```

Stamps `apps/<slug>.html` (or `--dest`) from `.app-template.html` — the DEFAULT
single-file app skeleton, extracted from the salesforced SF Ownership Desk:

- Geist Sans/Mono/Pixel embedded (fully offline), monochrome base + 10
  switchable themes (`t` to cycle; live preview from the command bar)
- ⌘K / ⌘; command bar with fuzzy search (navigate / filter / sort / theme /
  actions / help groups)
- Sortable records table + grouped board view, clickable KPI tiles, filter
  chips, search, right-side detail drawer, confirm modal, toast stack
- Full keyboard layer (`/`, `j`/`k`, `↵`, `o`, `c`, `g r`/`g b`, `?`, `esc`),
  CSV export, `localStorage` state, responsive to mobile, reduced-motion safe

The stamped file ships with fictional sample rows — replace the `DATA` array
(shape documented inline); nothing else needs to change. `--template <name>`
selects an optional `.app-template-<name>.html` variant when present; the
unnamed skeleton is the default. Plan templates remain separate options for
`plans new`.

## Serving apps (portless — REQUIRED, no raw ports)

```bash
bun run plans serve <command…>            # e.g. bun run plans serve bun web/server.ts
bun run plans serve --name api <command…> # rare: extra name for a second server
```

Any server that backs an HTML page/app in this repo MUST be started through
`plans serve`, which wraps [portless](https://www.npmjs.com/package/portless):

- **One name per repo, created once.** `plans.config.json` carries `appName`
  (auto-derived from the repo folder on first use; edit it once to taste, then
  commit). Every HTML page/app in the repo reuses the SAME name — pages are
  distinguished by *route*, never by port.
- **Stable URL, zero port conflicts.** The app is always at
  `https://<appName>.localhost`. portless injects a free `PORT` (plus `HOST`
  and `PORTLESS_URL`) into the child, so two repos — or a crashed old
  process — can never collide with `EADDRINUSE` again.
- **Server contract:** listen on `Number(process.env.PORT || 0)` (0 = ephemeral
  fallback for direct runs), bind `process.env.HOST` when set, and when
  auto-opening a browser prefer `process.env.PORTLESS_URL`. NEVER hardcode a
  port number in code, scripts, or docs.
- **package.json:** wire app scripts through the wrapper, e.g.
  `"web": "bun scripts/plans.mjs serve bun web/server.ts"`.
- Cross-service refs: `portless get <name>`. No portless installed? The wrapper
  warns and falls back to a direct run on an ephemeral port.

## Convention

- One plan = one `*.html` file: `YYYY-MM-DD-NNN-short-title.html`. `NNN` is the
  repo-monotonic sequence — highest number is always the latest plan.
- `plans.config.json` holds the repo's randomized accent color, `nextSeq`, and
  the portless `appName`. Commit it; it keeps every machine's plans cohesive
  and every machine's app URL identical.
- Every page is interactive: ✓ approve / ✗ reject / double-click-edit each
  decision, then **Submit to Claude** (localhost listener, JSON download
  fallback). Decisions persist in `localStorage`.
- `DESIGN.md` holds the visual system + the decision-item contract.
- Pages are fully self-contained (inline CSS/JS, system fonts): they open from
  `file://` with no server and no build step.

This folder + `scripts/plans.mjs` are auto-scaffolded and version-upgraded from
`~/.claude/templates/plans/` by a SessionStart hook. Hook-owned files:
`plans.mjs`, `.plan-template.html`, `.app-template.html`, `DESIGN.md`,
`README.md`, `index.html`.
Plan pages themselves are never touched. Opt a repo out with an empty
`.no-claude-plans` file at its root.
