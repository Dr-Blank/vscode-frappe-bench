const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Returns sorted list of Frappe site names found in <benchRoot>/sites/.
 * A valid site directory contains a site_config.json file.
 * @param {string} benchRoot
 * @returns {string[]}
 */
function findSites(benchRoot) {
    const sitesDir = path.join(benchRoot, 'sites');
    return fs.readdirSync(sitesDir)
        .filter(name => {
            try {
                return fs.statSync(path.join(sitesDir, name)).isDirectory()
                    && fs.existsSync(path.join(sitesDir, name, 'site_config.json'));
            } catch {
                return false;
            }
        })
        .sort();
}

/**
 * Resolves the bench root: uses the setting if set, otherwise ~/frappe-bench.
 * @returns {string}
 */
function getBenchRoot() {
    const cfg = vscode.workspace.getConfiguration('frappeBench');
    const configured = cfg.get('benchRoot', '').trim();
    return configured || path.join(os.homedir(), 'frappe-bench');
}

/**
 * Command: frappeBench.pickSite
 * Shows a QuickPick with all local Frappe sites and returns the chosen name.
 * Returns an empty string if the user cancels; tasks treat that as a no-op.
 * @returns {Promise<string>}
 */
async function pickSite() {
    const benchRoot = getBenchRoot();
    let sites;

    try {
        sites = findSites(benchRoot);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Frappe Bench Tools: cannot read sites from ${benchRoot}/sites: ${err.message}`
        );
        return '';
    }

    if (sites.length === 0) {
        vscode.window.showErrorMessage(
            `Frappe Bench Tools: no Frappe sites found in ${benchRoot}/sites`
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

function activate(/** @type {vscode.ExtensionContext} */ context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('frappeBench.pickSite', pickSite)
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
