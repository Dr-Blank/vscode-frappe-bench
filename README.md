# Frappe Bench Tools for VS Code

Run common `bench` commands straight from VS Code without touching a terminal. Site and app selection happens through a visual picker, so you never have to remember site names or type them out.

## Why use this

When you work with multiple Frappe sites, every bench command needs a `--site` flag. Without this extension you end up typing `bench --site mysite.localhost migrate` every time. With it, you open the command palette, pick your site from a list, and the command runs. Same goes for app-specific commands.

## Commands

Open the command palette with **Cmd/Ctrl+Shift+P** and type `Frappe Bench` to see all commands.

| Command | What it runs |
|---------|-------------|
| `Frappe Bench: Pick Site` | Open site picker (used by task inputs) |
| `Frappe Bench: Migrate` | `bench --site <site> migrate` |
| `Frappe Bench: Clear Cache` | `bench --site <site> clear-cache` |
| `Frappe Bench: Migrate + Clear Cache` | Migrate then clear cache in one step |
| `Frappe Bench: Build Assets` | `bench build` (all apps) |
| `Frappe Bench: Build Assets (App)` | `bench build --app <app>` |
| `Frappe Bench: Export Fixtures` | `bench --site <site> export-fixtures` |
| `Frappe Bench: Export Fixtures (App)` | `bench --site <site> export-fixtures --app <app>` |
| `Frappe Bench: Console` | `bench --site <site> console` |
| `Frappe Bench: Restart` | `bench restart` |
| `Frappe Bench: Update (--reset --no-backup)` | `bench update --reset --no-backup` |
| `Frappe Bench: Stop Web Worker` | `supervisorctl stop` gunicorn web worker |
| `Frappe Bench: Start Web Worker` | `supervisorctl start` gunicorn web worker |
| `Frappe Bench: Execute Python Snippet` | Run an ad-hoc expression in bench context |

Commands that need a site show a Quick Pick list of all sites found under `bench/sites/`. If your bench only has one site, it skips the picker and runs immediately.

Commands that need an app work the same way. If your workspace is already inside `bench/apps/<appname>/`, the extension detects that and uses your current app without asking.

## Site picker in tasks.json

You can wire the site picker into any task so `${input:site}` shows a Quick Pick at runtime instead of a terminal prompt.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "bench: migrate",
      "type": "shell",
      "command": "bench --site ${input:site} migrate",
      "options": { "cwd": "${workspaceFolder}" }
    }
  ],
  "inputs": [
    {
      "id": "site",
      "type": "command",
      "command": "frappeBench.pickSite"
    }
  ]
}
```

Run it from **Terminal > Run Task** and VS Code prompts you to pick a site before the command fires.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `frappeBench.benchRoot` | *(auto-detect)* | Absolute path to your bench root. Leave empty to auto-detect. |

**Auto-detection** walks up from your open workspace folder looking for a directory that contains `sites/`, `apps/`, and `env/`. This works whether your workspace is the bench root itself or a nested app folder like `apps/myapp/`. Falls back to `~/frappe-bench` if nothing is found.

Override only if your bench is outside the workspace tree:

```json
// .vscode/settings.json
{
  "frappeBench.benchRoot": "/opt/custom-bench"
}
```

## Adding your own bench command

If you need a bench command that is not built in, add it to your workspace `tasks.json` and use `frappeBench.pickSite` as the site input:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "bench: export-fixtures",
      "type": "shell",
      "command": "bench --site ${input:site} export-fixtures --app myapp",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": {
        "reveal": "always",
        "panel": "dedicated",
        "clear": true,
        "focus": true
      },
      "problemMatcher": []
    }
  ],
  "inputs": [
    {
      "id": "site",
      "type": "command",
      "command": "frappeBench.pickSite"
    }
  ]
}
```

Run it via **Terminal > Run Task** or bind it to a keyboard shortcut.

## Installation

### From VS Code Marketplace

Search **"Frappe Bench Tools"** in the Extensions panel, or install from the command line:

```bash
code --install-extension drblank.vscode-frappe-bench
```

### From VSIX (team or internal use)

```bash
# Build the .vsix
npm run package
npx @vscode/vsce package

# Install on any developer machine
code --install-extension vscode-frappe-bench-0.2.0.vsix
```
