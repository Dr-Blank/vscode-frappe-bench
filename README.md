# Frappe Bench Tools for VS Code

VS Code extension that integrates with your local [Frappe bench](https://frappeframework.com/docs/user/en/bench) setup.

## Features

### Command palette commands

All commands are available via **Cmd/Ctrl+Shift+P** → type `Frappe Bench`.

| Command | Description |
|---------|-------------|
| `Frappe Bench: Pick Site` | Show site picker (used by task inputs) |
| `Frappe Bench: Migrate` | `bench --site <site> migrate` |
| `Frappe Bench: Clear Cache` | `bench --site <site> clear-cache` |
| `Frappe Bench: Migrate + Clear Cache` | Migrate then clear cache in one step |
| `Frappe Bench: Build Assets` | `bench build` (all apps) |
| `Frappe Bench: Console` | `bench --site <site> console` |
| `Frappe Bench: Restart` | `bench restart` |
| `Frappe Bench: Update (--reset --no-backup)` | `bench update --reset --no-backup` |
| `Frappe Bench: Stop Web Worker` | `supervisorctl stop` gunicorn web worker |
| `Frappe Bench: Start Web Worker` | `supervisorctl start` gunicorn web worker |
| `Frappe Bench: Execute Python Snippet` | Run an ad-hoc expression in bench context |

Site-specific commands open a Quick Pick to choose the target site first.

### Site picker as task input (`frappeBench.pickSite`)

Wire the site picker into any `tasks.json` so `${input:site}` resolves to a VS Code Quick Pick at runtime instead of a terminal prompt.

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

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `frappeBench.benchRoot` | *(auto-detect)* | Absolute path to your bench root. Leave empty to auto-detect. |

**Auto-detection** walks up from your open workspace folder looking for a directory that contains `sites/`, `apps/`, and `env/` — so it works whether your workspace is the bench root itself or a nested app (`apps/myapp/`). Falls back to `~/frappe-bench` if nothing is found.

Override only if your bench is outside the workspace tree entirely:

```json
// .vscode/settings.json
{
  "frappeBench.benchRoot": "/opt/custom-bench"
}
```

## Adding a custom bench command

If a bench command you need isn't built in, add it to your workspace `tasks.json` and use `frappeBench.pickSite` as the site input:

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

Run it via **Terminal → Run Task** or bind it to a keyboard shortcut.

## Installation

### From VSIX (team/internal use)

```bash
# Build the .vsix
npm run package
npx @vscode/vsce package

# Install on any developer machine
code --install-extension vscode-frappe-bench-0.2.0.vsix
```

### From VS Code Marketplace

Search **"Frappe Bench Tools"** in the Extensions panel, or:

```bash
code --install-extension drblank.vscode-frappe-bench
```
