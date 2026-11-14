import Utils from './utils.js';
import { t } from './i18n.js';

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Triggered0/Hex-Manager/releases/latest';

let currentVersion = '1.1.0';
let latestRelease = null;
let updateCheckPending = false;
let updateBadgeCallback = null;

export function getCurrentVersion() {
    return currentVersion;
}

export function getLatestRelease() {
    return latestRelease;
}

export function setUpdateBadgeCallback(cb) {
    updateBadgeCallback = cb;
}

export async function syncVersionWithMetadata() {
    try {
        const indexUrl = new URL('../index.js', import.meta.url);
        const response = await fetch(indexUrl);
        const text = await response.text();
        const match = text.match(/@version\s+([\d.]+)/);
        if (match && match[1]) {
            currentVersion = match[1];
            Utils.Debug.log('[Hex-Manager] Version synced:', currentVersion);
        }
    } catch (err) {
        Utils.Debug.warn('[Hex-Manager] Failed to sync version:', err);
    }
}

function parseVersion(v) {
    return (v || '').replace(/^v/, '').trim();
}

function isNewerVersion(latest, current) {
    const l = parseVersion(latest).split('.').map(Number);
    const c = parseVersion(current).split('.').map(Number);
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const lv = l[i] || 0;
        const cv = c[i] || 0;
        if (lv > cv) return true;
        if (lv < cv) return false;
    }
    return false;
}

export async function checkForUpdates(force = false) {
    const autoCheck = Utils.Store.get('core', 'checkUpdates');
    if (autoCheck === false && !force) return;
    if (updateCheckPending) return;
    updateCheckPending = true;
    try {
        const resp = await fetch(GITHUB_RELEASES_API);
        if (!resp.ok) return;
        const data = await resp.json();
        const latestVer = parseVersion(data.tag_name || data.name || '');
        if (latestVer && isNewerVersion(latestVer, currentVersion)) {
            latestRelease = {
                version: latestVer,
                url: data.html_url || 'https://github.com/Triggered0/Hex-Manager/releases',
                name: data.name || `v${latestVer}`,
                body: (data.body || '').slice(0, 500)
            };
        } else {
            latestRelease = null;
        }
        if (updateBadgeCallback) updateBadgeCallback(latestRelease);
        if (latestRelease) {
            Utils.Toast.warning(
                t('Hex-Manager update available: v{{version}} — check Settings > Updates!', { version: latestRelease.version }),
                { duration: 10000, closable: true, position: 'bottom-right' }
            );
        }
    } catch (err) {
        Utils.Debug.warn('[Hex-Manager] Update check failed:', err);
    } finally {
        updateCheckPending = false;
    }
}
