/**
 * @name Hex-ChampSelectQuitButton
 * @version 1.1.0
 * @author Triggered0
 * @description Adds a dodge button in champion select for quick lobby exit.
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils, { t } from '../core/utils.js';

let isEnabled = false;
let _hookCleanups = [];
let _domObserverCleanup = null;

function toggleFeature(enabled) {
    isEnabled = enabled;
    Utils.Store.set('champSelectQuitButton', 'enabled', enabled);
    if (!enabled) {
        document.querySelectorAll('#pm-quit-btn').forEach(btn => btn.remove());
    }
}

async function resolveLeagueEdgeUrl() {
    try {
        const url = await Utils.LCU.get('/client-config/v2/config/lol.client_settings.league_edge.url');
        if (typeof url === 'string' && url.trim()) {
            return url.trim().replace(/\/+$/, '');
        }
    } catch (_) {}

    try {
        const ns = await Utils.LCU.get('/client-config/v2/namespace/lol.client_settings');
        const url = ns?.['lol.client_settings.league_edge.url'];
        if (typeof url === 'string' && url.trim()) {
            return url.trim().replace(/\/+$/, '');
        }
    } catch (_) {}

    return null;
}

export async function dodgeQueue() {
    const [edgeUrl, sessionToken] = await Promise.all([
        resolveLeagueEdgeUrl(),
        Utils.LCU.get('/lol-league-session/v1/league-session-token').catch(() => null)
    ]);

    if (edgeUrl && typeof sessionToken === 'string' && sessionToken.trim()) {
        const headers = {
            Authorization: `Bearer ${sessionToken.trim()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(`${edgeUrl}/team-builder-ledge/v1/logout`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ softDisconnect: false })
            });
            const bodyText = await response.text().catch(() => '');
            Utils.Debug.log(`[DodgeButton] SGP team-builder logout: status=${response.status} body=${bodyText}`);
            if (response.ok && bodyText.includes('LOGOUT_SUCCESS')) {
                return;
            }
        } catch (err) {
            Utils.Debug.error('[DodgeButton] SGP team-builder logout failed:', err);
        }
    }

    try {
        await Utils.LCU.post('/lol-lobby-team-builder/champ-select/v1/session/quit', {});
        Utils.Debug.log('[DodgeButton] session/quit sent');
    } catch (err) {
        Utils.Debug.debug('[DodgeButton] session/quit skipped or failed:', err);
    }

    try {
        await Utils.LCU.post('/lol-lobby/v1/lobby/custom/cancel-champ-select', null);
        Utils.Debug.log('[DodgeButton] cancel-champ-select sent');
    } catch (err) {
        Utils.Debug.debug('[DodgeButton] cancel-champ-select failed:', err);
    }
}

export function init(context) {
    Utils.Settings.inject(context, {
        name: "dodge-button-settings",
        titleKey: "snooze_dodge-button",
        titleName: t('Dodge Button'),
        capitalTitleKey: "snooze_dodge-button_capital",
        capitalTitleName: t('DODGE BUTTON'),
        class: "dodge-button-settings"
    });

    isEnabled = Utils.Store.get('champSelectQuitButton', 'enabled') || false;

    _hookCleanups.push(Utils.Hooks.Ember.registerRule({
        name: 'champ-select-quit-button-hook',
        matcher: 'champion-select',
        hookMethods: [{
            name: 'didInsertElement',
            callback(Ember, original, ...args) {
                original(...args);
                if (!Utils.Store.get('champSelectQuitButton', 'enabled')) return;
                if (!this.element) return;

                const container = this.element.querySelector('.bottom-right-buttons');
                if (!container) return;

                if (!container.querySelector('#pm-quit-btn')) {
                    const btn = document.createElement('lol-uikit-flat-button');
                    btn.id = 'pm-quit-btn';
                    btn.textContent = t('Dodge');
                    btn.style.cssText = 'margin-right: 10px; margin-top: 5px; width: auto; min-width: 80px; text-align: center;';

                    let dodging = false;
                    btn.addEventListener('click', async () => {
                        if (dodging) return;
                        dodging = true;
                        btn.setAttribute('disabled', 'true');
                        try {
                            await dodgeQueue();
                        } finally {
                            setTimeout(() => {
                                dodging = false;
                                btn.removeAttribute('disabled');
                            }, 1000);
                        }
                    });

                    if (container.firstChild) {
                        container.insertBefore(btn, container.firstChild);
                    } else {
                        container.appendChild(btn);
                    }
                }
            }
        }, {
            name: 'willDestroyElement',
            callback(Ember, original, ...args) {
                const btn = document.getElementById('pm-quit-btn');
                if (btn) btn.remove();
                original(...args);
            }
        }]
    }));

    if (window.HexManager && window.HexManager.registerModule) {
        window.HexManager.registerModule({
            id: 'champSelectQuitButton',
            name: t('Champ Select Dodge Button'),
            description: t('Adds a dodge button in the champion select.'),
            settings: [{
                type: 'toggle',
                id: 'sm:champSelectQuitButton',
                label: t('Enable Champ Select Dodge Button'),
                value: isEnabled,
                onChange: (val) => toggleFeature(val)
            }]
        });
    } else {
        _domObserverCleanup = Utils.DOM.observer.observe("lol-uikit-scrollable.dodge-button-settings", (plugin) => {
            plugin.appendChild(Utils.Settings.createToggleRow("Enable Dodge Button", isEnabled, (next) => {
                isEnabled = next;
                toggleFeature(isEnabled);
            }));
        });
    }
}

export function load() {
    // Rely exclusively on Ember Hook rendering the component to manage DOM lifecycle.
}

export function unload() {
    for (const cleanup of _hookCleanups) cleanup?.();
    _hookCleanups = [];
    if (typeof _domObserverCleanup === 'function') _domObserverCleanup();
    _domObserverCleanup = null;
}
