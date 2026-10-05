# Supabase MCP setup

`config.toml` prepares the project-scoped Supabase MCP server for the explicitly
approved development project `bcvfosxcyvarieiinovo`. The owner confirmed this
project during the P2P baseline task on 2026-10-05; it matches the current
environment bindings and supersedes the earlier `ytzvnbwrgvkkixtgnjcg` example.
The server is configured with `read_only=true` for this baseline. It contains no credentials.
Codex must trust this project to load project-scoped configuration. A new Codex
session is needed to load newly configured tools.

In this cloud session, `codex mcp add` cannot save global configuration because
the Codex configuration directory is mounted read-only. The MCP management CLI
does not list this project configuration automatically here. A URL override lists
the server as enabled with authentication **Unknown**; authentication is not
complete, and no Supabase MCP tools have been loaded into this session.

Complete setup in your own interactive terminal with a writable Codex configuration:

```sh
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=bcvfosxcyvarieiinovo&read_only=true&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
codex mcp login supabase
codex mcp list
```

Finish OAuth in the browser opened by the login command. Then start/restart Codex
and run `/mcp` inside its interactive interface to inspect tools and authentication.
`/mcp` is a Codex slash command, not a shell command. Keep OAuth callback URLs,
tokens and database credentials out of chat and version control.

## Claude Code

The root `.mcp.json` also configures this same development server for Claude Code.
Claude's project configuration is separate from Codex's `.codex/config.toml`.
The `claude` CLI is not installed in this cloud environment, so its add/authenticate
commands cannot run here. In your own regular terminal, from this repository:

```sh
claude /mcp
```

Select `supabase` and Authenticate, finish browser OAuth, then reload the client.
The checked-in project configuration already provides the server; there is no
need to add it twice. If configuring a fresh checkout without `.mcp.json`, use:

```sh
claude mcp add --scope project --transport http supabase 'https://mcp.supabase.com/mcp?project_ref=bcvfosxcyvarieiinovo&read_only=true&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
```

Configuring a URL does not authenticate either client or load new tools into an
already running Codex session. No authenticated Supabase MCP tools are available
in the current cloud task. Read-only HTTPS schema/count capture works independently
through the supplied development bindings; PostgreSQL TCP was refused during the
baseline check. See [the control baseline](../purchase-backend/docs/architecture/p2p-control-baseline.md).

## Installed skills

The official `supabase` and `supabase-postgres-best-practices` skills are installed
in `.agents/skills`, with their source hashes recorded in `skills-lock.json`.
To install them again in another checkout:

```sh
npx skills add supabase/agent-skills --agent codex --yes
```

Project scoping limits the destination; database operations must still follow
`AGENTS.md`. Do not change the project reference to production or automatically
apply production migrations.
