# Supabase MCP setup

`config.toml` prepares the project-scoped Supabase MCP server for the explicitly
approved development project `ytzvnbwrgvkkixtgnjcg`. It contains no credentials.
Codex must trust this project to load project-scoped configuration. A new Codex
session is needed to load newly configured tools.

In this cloud session, `codex mcp add` cannot save global configuration because
the Codex configuration directory is mounted read-only. The MCP management CLI
does not list this project configuration automatically here. A URL override lists
the server as enabled with authentication **Unknown**; authentication is not
complete, and no Supabase MCP tools have been loaded into this session.

Complete setup in your own interactive terminal with a writable Codex configuration:

```sh
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=ytzvnbwrgvkkixtgnjcg&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
codex mcp login supabase
codex mcp list
```

Finish OAuth in the browser opened by the login command. Then start/restart Codex
and run `/mcp` inside its interactive interface to inspect tools and authentication.
`/mcp` is a Codex slash command, not a shell command. Keep OAuth callback URLs,
tokens and database credentials out of chat and version control.

The official `supabase` and `supabase-postgres-best-practices` skills are installed
in `.agents/skills`, with their source hashes recorded in `skills-lock.json`.
To install them again in another checkout:

```sh
npx skills add supabase/agent-skills --agent codex --yes
```

Project scoping limits the destination; database operations must still follow
`AGENTS.md`. Do not change the project reference to production or automatically
apply production migrations.
