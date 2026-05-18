import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Bench root detection ──────────────────────────────────────────────────────

/**
 * Walk up from startDir looking for a Frappe bench root.
 * A bench root contains sites/, apps/, and env/ as direct children.
 */
function detectBenchRoot(startDir: string): string | undefined {
    let dir = startDir;
    while (true) {
        if (
            fs.existsSync(path.join(dir, 'sites')) &&
            fs.existsSync(path.join(dir, 'apps')) &&
            fs.existsSync(path.join(dir, 'env'))
        ) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) { return undefined; }
        dir = parent;
    }
}

/**
 * Resolve the bench root using (in order):
 *   1. frappeBench.benchRoot setting (if set)
 *   2. Walk up from each workspace folder
 *   3. ~/frappe-bench fallback
 */
function getBenchRoot(): string {
    const cfg = vscode.workspace.getConfiguration('frappeBench');
    const configured = cfg.get<string>('benchRoot', '').trim();
    if (configured) {
        return configured;
    }

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const folder of folders) {
            const detected = detectBenchRoot(folder.uri.fsPath);
            if (detected) {
                return detected;
            }
        }
    }

    return path.join(os.homedir(), 'frappe-bench');
}

// ── Site discovery ────────────────────────────────────────────────────────────

function findSites(benchRoot: string): string[] {
    const sitesDir = path.join(benchRoot, 'sites');
    return fs.readdirSync(sitesDir)
        .filter((name: string) => {
            try {
                return (
                    fs.statSync(path.join(sitesDir, name)).isDirectory() &&
                    fs.existsSync(path.join(sitesDir, name, 'site_config.json'))
                );
            } catch {
                return false;
            }
        })
        .sort();
}

// ── Site picker (used as task input provider) ─────────────────────────────────

async function pickSite(): Promise<string> {
    const benchRoot = getBenchRoot();
    let sites: string[];

    try {
        sites = findSites(benchRoot);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Frappe Bench: cannot read sites from ${benchRoot}/sites: ${(err as Error).message}`
        );
        return '';
    }

    if (sites.length === 0) {
        vscode.window.showErrorMessage(
            `Frappe Bench: no Frappe sites found in ${benchRoot}/sites`
        );
        return '';
    }

    if (sites.length === 1) {
        return sites[0];
    }

    const picked = await vscode.window.showQuickPick(sites, {
        placeHolder: 'Select Frappe site',
        ignoreFocusOut: true,
    });

    return picked ?? '';
}

// ── Terminal helpers ──────────────────────────────────────────────────────────

function runInTerminal(name: string, command: string, cwd?: string): void {
    const terminal = vscode.window.createTerminal({
        name,
        cwd: cwd ?? getBenchRoot(),
    });
    terminal.show(false);
    terminal.sendText(command);
}

async function runSiteCommand(
    terminalName: string,
    buildCommand: (site: string) => string,
    cwd?: string
): Promise<void> {
    const site = await pickSite();
    if (!site) { return; }
    runInTerminal(terminalName, buildCommand(site), cwd ?? getBenchRoot());
}

// ── Command registrations ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    const bench = getBenchRoot;

    context.subscriptions.push(

        // ── Site picker (task input provider) ──────────────────────────────
        vscode.commands.registerCommand('frappeBench.pickSite', pickSite),

        // ── bench migrate ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.migrate', () =>
            runSiteCommand('bench: migrate', site =>
                `bench --site ${site} migrate`
            )
        ),

        // ── bench clear-cache ───────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.clearCache', () =>
            runSiteCommand('bench: clear-cache', site =>
                `bench --site ${site} clear-cache`
            )
        ),

        // ── bench migrate + clear-cache ─────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.migrateAndClearCache', () =>
            runSiteCommand('bench: migrate + clear-cache', site =>
                `bench --site ${site} migrate && bench --site ${site} clear-cache`
            )
        ),

        // ── bench build (all apps) ──────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.build', () =>
            runInTerminal('bench: build', 'bench build', bench())
        ),

        // ── bench console ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.console', () =>
            runSiteCommand('bench: console', site =>
                `bench --site ${site} console`
            )
        ),

        // ── bench restart ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.restart', () =>
            runInTerminal('bench: restart', 'bench restart', bench())
        ),

        // ── bench update --reset --no-backup ────────────────────────────────
        vscode.commands.registerCommand('frappeBench.update', () =>
            runInTerminal('bench: update', 'bench update --reset --no-backup', bench())
        ),

        // ── supervisorctl: stop web ─────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.stopWeb', () =>
            runInTerminal(
                'bench: stop web',
                'sudo supervisorctl stop frappe-bench-web:frappe-bench-frappe-web',
                bench()
            )
        ),

        // ── supervisorctl: start web ────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.startWeb', () =>
            runInTerminal(
                'bench: start web',
                'sudo supervisorctl start frappe-bench-web:frappe-bench-frappe-web',
                bench()
            )
        ),

        // ── bench --site <site> execute (ad-hoc python snippet) ────────────
        vscode.commands.registerCommand('frappeBench.execute', async () => {
            const site = await pickSite();
            if (!site) { return; }
            const snippet = await vscode.window.showInputBox({
                prompt: 'Python expression to execute in bench console',
                placeHolder: 'frappe.get_doc("User", "Administrator").first_name',
                ignoreFocusOut: true,
            });
            if (!snippet) { return; }
            runInTerminal(
                'bench: execute',
                `bench --site ${site} execute --args '${snippet.replace(/'/g, "'\\''")}'`,
                bench()
            );
        }),
    );
}

export function deactivate(): void {}
