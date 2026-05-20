import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── CLI command builders ──────────────────────────────────────────────────────
// Single source of truth for all CLI tokens. Change here; everything updates.

const BENCH_CMD = 'bench';
const SITE_FLAG = '--site';
const APP_FLAG = '--app';
const SUPERVISOR_WEB_SERVICE = 'frappe-bench-web:frappe-bench-frappe-web';

function benchCmd(...args: string[]): string {
    return [BENCH_CMD, ...args].join(' ');
}

function benchSiteCmd(site: string, ...args: string[]): string {
    return [BENCH_CMD, SITE_FLAG, site, ...args].join(' ');
}

function supervisorCtlCmd(action: string, service: string): string {
    return `sudo supervisorctl ${action} ${service}`;
}

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

// ── App discovery ─────────────────────────────────────────────────────────────

function findApps(benchRoot: string): string[] {
    const appsDir = path.join(benchRoot, 'apps');
    return fs.readdirSync(appsDir)
        .filter((name: string) => {
            try {
                return fs.statSync(path.join(appsDir, name)).isDirectory();
            } catch {
                return false;
            }
        })
        .sort();
}

// ── App picker (smart: auto-detects if workspace is inside bench/apps/<app>) ──

async function pickApp(): Promise<string> {
    const benchRoot = getBenchRoot();
    const appsDir = path.join(benchRoot, 'apps');

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const folder of folders) {
            const rel = path.relative(appsDir, folder.uri.fsPath);
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                const appName = rel.split(path.sep)[0];
                if (appName && !appName.startsWith('.')) {
                    return appName;
                }
            }
        }
    }

    let apps: string[];
    try {
        apps = findApps(benchRoot);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Frappe Bench: cannot read apps from ${appsDir}: ${(err as Error).message}`
        );
        return '';
    }

    if (apps.length === 0) {
        vscode.window.showErrorMessage(`Frappe Bench: no apps found in ${appsDir}`);
        return '';
    }

    if (apps.length === 1) {
        return apps[0];
    }

    const picked = await vscode.window.showQuickPick(apps, {
        placeHolder: 'Select Frappe app',
        ignoreFocusOut: true,
    });

    return picked ?? '';
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

// ── Task helpers ──────────────────────────────────────────────────────────────

interface TaskOptions {
    panel?: vscode.TaskPanelKind;
    focus?: boolean;
    clear?: boolean;
}

function makeTask(
    name: string,
    command: string,
    cwd: string,
    opts: TaskOptions = {}
): vscode.Task {
    const {
        panel = vscode.TaskPanelKind.Dedicated,
        focus = false,
        clear = false,
    } = opts;
    const task = new vscode.Task(
        { type: 'frappe-bench' },
        vscode.TaskScope.Workspace,
        name,
        'Frappe Bench',
        new vscode.ShellExecution(command, { cwd })
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel, focus, clear };
    return task;
}

function runTask(name: string, command: string, cwd: string, opts: TaskOptions = {}): void {
    vscode.tasks.executeTask(makeTask(name, command, cwd, opts));
}

async function runSiteTask(
    taskName: string,
    buildCommand: (site: string) => string,
    opts: TaskOptions = {}
): Promise<void> {
    const site = await pickSite();
    if (!site) { return; }
    runTask(taskName, buildCommand(site), getBenchRoot(), opts);
}

// ── Command registrations ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    const bench = getBenchRoot;

    context.subscriptions.push(

        // ── Site picker (task input provider) ──────────────────────────────
        vscode.commands.registerCommand('frappeBench.pickSite', pickSite),

        // ── bench migrate ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.migrate', () =>
            runSiteTask('bench: migrate', site => benchSiteCmd(site, 'migrate'), { focus: true, clear: true })
        ),

        // ── bench clear-cache ───────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.clearCache', () =>
            runSiteTask('bench: clear-cache', site => benchSiteCmd(site, 'clear-cache'), { focus: true, clear: true })
        ),

        // ── bench migrate + clear-cache ─────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.migrateAndClearCache', () =>
            runSiteTask('bench: migrate + clear-cache', site =>
                `${benchSiteCmd(site, 'migrate')} && ${benchSiteCmd(site, 'clear-cache')}`,
                { focus: true, clear: true }
            )
        ),

        // ── bench build (all apps) ──────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.build', () =>
            runTask('bench: build', benchCmd('build'), bench())
        ),

        // ── bench build --app <app> ─────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.buildApp', async () => {
            const app = await pickApp();
            if (!app) { return; }
            runTask('bench: build app', benchCmd('build', APP_FLAG, app), bench());
        }),

        // ── bench --site <site> export-fixtures ─────────────────────────────
        vscode.commands.registerCommand('frappeBench.exportFixtures', () =>
            runSiteTask('bench: export fixtures',
                site => benchSiteCmd(site, 'export-fixtures'),
                { focus: true, clear: true }
            )
        ),

        // ── bench --site <site> export-fixtures --app <app> ────────────────
        vscode.commands.registerCommand('frappeBench.exportFixturesApp', async () => {
            const site = await pickSite();
            if (!site) { return; }
            const app = await pickApp();
            if (!app) { return; }
            runTask('bench: export fixtures (app)',
                benchSiteCmd(site, 'export-fixtures', APP_FLAG, app),
                bench(),
                { focus: true, clear: true }
            );
        }),

        // ── bench console ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.console', () =>
            runSiteTask('bench: console', site => benchSiteCmd(site, 'console'), { panel: vscode.TaskPanelKind.New })
        ),

        // ── bench restart ───────────────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.restart', () =>
            runTask('bench: restart', benchCmd('restart'), bench())
        ),

        // ── bench update --reset --no-backup ────────────────────────────────
        vscode.commands.registerCommand('frappeBench.update', () =>
            runTask('bench: update', benchCmd('update', '--reset', '--no-backup'), bench())
        ),

        // ── supervisorctl: stop web ─────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.stopWeb', () =>
            runTask(
                'bench: stop web',
                supervisorCtlCmd('stop', SUPERVISOR_WEB_SERVICE),
                bench(),
                { panel: vscode.TaskPanelKind.Shared }
            )
        ),

        // ── supervisorctl: start web ────────────────────────────────────────
        vscode.commands.registerCommand('frappeBench.startWeb', () =>
            runTask(
                'bench: start web',
                supervisorCtlCmd('start', SUPERVISOR_WEB_SERVICE),
                bench(),
                { panel: vscode.TaskPanelKind.Shared }
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
            runTask(
                'bench: execute',
                benchSiteCmd(site, 'execute', `--args '${snippet.replace(/'/g, "'\\''")}'`),
                bench(),
                { panel: vscode.TaskPanelKind.New }
            );
        }),
    );
}

export function deactivate(): void {}
