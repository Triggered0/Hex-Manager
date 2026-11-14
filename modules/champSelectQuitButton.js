/**
 * @name Hex-ChampSelectQuitButton
 * @version 1.2.0
 * @author Triggered0
 * @description Adds a dodge button in champion select with SGP logout and next dodge penalty/lockout preview.
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils, { t } from '../core/utils.js';

const PHASE_URI = '/lol-gameflow/v1/gameflow-phase';
const GAMEFLOW_URI = '/lol-gameflow/v1/session';
const SEARCH_STATE_URI = '/lol-lobby/v2/lobby/matchmaking/search-state';
const SUMMONER_URI = '/lol-summoner/v1/current-summoner';
const RANKED_STATS_URI = '/lol-ranked/v1/current-ranked-stats';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOCKOUT_MINUTES = { 1: 6, 2: 30, 3: 720 };
const ARAM_LOCKOUT_MINUTES = { 1: 15, 2: 30, 3: 720 };
const RANKED_LP = { 1: 5, 2: 15, 3: 15 };
const APEX_FIRST_DODGE_LP = 20;
const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
const LOCKOUTS = [
    [6, 1],
    [15, 1],
    [30, 2]
];
const FRESH_WINDOW_S = 180;

let isEnabled = false;
let showPenalty = true;
let _hookCleanups = [];
let _domObserverCleanup = null;
let _lcuUnsubs = [];

const penaltyState = {
    phase: null,
    queue: null,
    summoner: null,
    penalty: null,
    quitSent: false
};

function readAccounts() {
    const stored = Utils.Store.get('champSelectQuitButton', 'accounts', {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
}

function writeAccounts(accounts) {
    Utils.Store.set('champSelectQuitButton', 'accounts', accounts);
}

function accountKey() {
    return penaltyState.summoner?.puuid || (penaltyState.summoner?.summonerId ? `sid:${penaltyState.summoner.summonerId}` : null);
}

function storedRecord() {
    const key = accountKey();
    if (!key) return null;
    const record = readAccounts()[key];
    return record && typeof record.tier === 'number' && typeof record.at === 'number' ? record : null;
}

export function currentTier(now = Date.now()) {
    const record = storedRecord();
    if (!record) return 0;
    const drops = Math.floor(Math.max(0, now - record.at) / DAY_MS);
    return Math.max(0, Math.min(3, record.tier - drops));
}

function saveTier(tier, at) {
    const key = accountKey();
    if (!key) return;
    const store = readAccounts();
    const previous = store[key];
    if (previous && previous.tier === tier && Math.abs(previous.at - at) < 10 * 60 * 1000) return;
    store[key] = { tier: Math.max(1, Math.min(3, tier)), at };
    writeAccounts(store);
}

function recordOwnDodge() {
    saveTier(Math.min(3, currentTier() + 1), Date.now());
}

function learnFromPenalty(remainingSeconds) {
    const remaining = Number(remainingSeconds);
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    if (remaining > 30 * 60) {
        saveTier(3, Date.now() - Math.max(0, 720 * 60 - remaining) * 1000);
        return;
    }
    for (const [minutes, tier] of LOCKOUTS) {
        const full = minutes * 60;
        if (remaining <= full && remaining >= full - FRESH_WINDOW_S) {
            saveTier(tier, Date.now() - (full - remaining) * 1000);
            return;
        }
    }
}

function queueOf(gameflow) {
    const queue = gameflow?.gameData?.queue;
    if (!queue) return null;
    return {
        id: Number(queue.id) || 0,
        type: String(queue.type ?? ''),
        gameMode: String(queue.gameMode ?? ''),
        isRanked: queue.isRanked === true,
        isCustom: Boolean(gameflow?.gameData?.isCustomGame || queue.isCustom)
    };
}

function isAram(queue) {
    return /ARAM/i.test(queue?.type ?? '') || /^ARAM$/i.test(queue?.gameMode ?? '');
}

function isRankedQueue(queue) {
    return Boolean(queue?.isRanked) || /^RANKED_/i.test(queue?.type ?? '');
}

function lockoutText(minutes) {
    if (minutes >= 60) return `${Math.round(minutes / 60)} ${t('hr lockout')}`;
    return `${minutes} ${t('min lockout')}`;
}

export async function computePenalty(queue) {
    if (!queue || queue.isCustom) return null;
    const tier = Math.min(currentTier() + 1, 3);
    const aram = isAram(queue);
    const lockout = (aram ? ARAM_LOCKOUT_MINUTES : LOCKOUT_MINUTES)[tier];
    const penalty = { tier, lockout, lp: 0, ranked: isRankedQueue(queue), placed: false, apex: false, aram };
    if (!penalty.ranked) return penalty;
    const stats = await Utils.LCU.get(RANKED_STATS_URI).catch(() => null);
    const entry = stats?.queueMap?.[queue.type] ?? null;
    const tierName = String(entry?.tier ?? '').toUpperCase();
    penalty.placed = Boolean(tierName) && tierName !== 'NONE' && tierName !== 'UNRANKED' && entry?.isProvisional !== true;
    penalty.apex = penalty.placed && APEX_TIERS.has(tierName);
    if (penalty.placed) penalty.lp = penalty.apex && tier === 1 ? APEX_FIRST_DODGE_LP : RANKED_LP[tier];
    return penalty;
}

function costText(penalty) {
    if (!penalty) return '';
    const parts = [];
    if (penalty.ranked) parts.push(penalty.lp > 0 ? `-${penalty.lp} LP` : t('No LP'));
    parts.push(lockoutText(penalty.lockout));
    return parts.join(' · ');
}

function costTitle(penalty) {
    if (!penalty) return t('Leave Champion Select immediately');
    const lines = [
        `${t('Next dodge')}: #${penalty.tier} (${costText(penalty)})`
    ];
    if (penalty.ranked && !penalty.placed) lines.push(t('Unplaced in this queue: no LP lost.'));
    if (penalty.apex) lines.push(t('Master+ dodges also affect MMR.'));
    lines.push(t('Dodges decay by 1 tier every 24 hours.'));
    return lines.join('\n');
}

function updateQuitButtonBadge() {
    const btn = document.getElementById('pm-quit-btn');
    if (!btn) return;
    let badge = btn.querySelector('.hm-dodge-cost');
    if (!showPenalty || !penaltyState.penalty) {
        badge?.remove();
        btn.title = t('Leave Champion Select immediately');
        return;
    }
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'hm-dodge-cost';
        badge.style.cssText = 'position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);white-space:nowrap;pointer-events:none;font-family:"Spiegel",var(--font-body),"Segoe UI",sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3px;line-height:13px;color:#c8aa6e;background:rgba(1,10,19,0.92);border:1px solid #463714;padding:1px 6px;border-radius:2px;text-shadow:0 1px 2px #000;z-index:10;';
        btn.style.position = 'relative';
        btn.style.overflow = 'visible';
        btn.appendChild(badge);
    }
    badge.textContent = costText(penaltyState.penalty);
    btn.title = costTitle(penaltyState.penalty);
}

async function refreshPenaltyInfo() {
    if (!isEnabled) return;
    try {
        if (!penaltyState.summoner) {
            const sum = await Utils.LCU.get(SUMMONER_URI).catch(() => null);
            if (sum) penaltyState.summoner = { puuid: sum.puuid || '', summonerId: sum.summonerId || 0 };
        }
        const gameflow = await Utils.LCU.get(GAMEFLOW_URI).catch(() => null);
        if (gameflow) penaltyState.queue = queueOf(gameflow);
        penaltyState.penalty = await computePenalty(penaltyState.queue);
        updateQuitButtonBadge();
    } catch (_) {}
}

function toggleFeature(enabled) {
    isEnabled = enabled;
    Utils.Store.set('champSelectQuitButton', 'enabled', enabled);
    if (!enabled) {
        document.querySelectorAll('#pm-quit-btn').forEach(btn => btn.remove());
    } else {
        refreshPenaltyInfo();
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
                penaltyState.quitSent = true;
                if (penaltyState.queue && !penaltyState.queue.isCustom) recordOwnDodge();
                return;
            }
        } catch (err) {
            Utils.Debug.error('[DodgeButton] SGP team-builder logout failed:', err);
        }
    }

    try {
        await Utils.LCU.post('/lol-lobby-team-builder/champ-select/v1/session/quit', {});
        penaltyState.quitSent = true;
        if (penaltyState.queue && !penaltyState.queue.isCustom) recordOwnDodge();
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
        name: 'dodge-button-settings',
        titleKey: 'snooze_dodge-button',
        titleName: t('Dodge Button'),
        capitalTitleKey: 'snooze_dodge-button_capital',
        capitalTitleName: t('DODGE BUTTON'),
        class: 'dodge-button-settings'
    });

    isEnabled = Utils.Store.get('champSelectQuitButton', 'enabled') || false;
    showPenalty = Utils.Store.get('champSelectQuitButton', 'showPenalty', true) !== false;

    _lcuUnsubs.push(
        Utils.LCU.observe(SEARCH_STATE_URI, (msg) => {
            const search = msg?.data ?? msg;
            if (!search || !penaltyState.summoner) return;
            for (const error of Array.isArray(search.errors) ? search.errors : []) {
                if (!/DODGE/i.test(String(error?.errorType ?? ''))) continue;
                const who = Number(error.penalizedSummonerId) || 0;
                if (who && penaltyState.summoner.summonerId && who !== penaltyState.summoner.summonerId) continue;
                learnFromPenalty(error.penaltyTimeRemaining);
            }
        }),
        Utils.LCU.observe(PHASE_URI, async (msg) => {
            const phase = typeof msg === 'string' ? msg : msg?.data;
            const prev = penaltyState.phase;
            penaltyState.phase = phase;
            if (prev === 'ChampSelect' && phase !== 'ChampSelect') {
                const gf = await Utils.LCU.get(GAMEFLOW_URI).catch(() => null);
                const dodgers = (gf?.gameDodge?.dodgeIds ?? []).map(Number);
                const me = Number(penaltyState.summoner?.summonerId) || 0;
                if (me && dodgers.includes(me) && !penaltyState.quitSent && !penaltyState.queue?.isCustom) {
                    recordOwnDodge();
                }
                penaltyState.quitSent = false;
            }
            if (phase === 'ChampSelect') {
                refreshPenaltyInfo();
            }
        })
    );

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
                    btn.style.cssText = 'margin-right: 10px; margin-top: 5px; width: auto; min-width: 80px; text-align: center; position: relative; overflow: visible;';

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

                    refreshPenaltyInfo();
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
            description: t('Adds an instant SGP dodge button in Champion Select with LP & lockout penalty preview.'),
            settings: [
                {
                    type: 'toggle',
                    id: 'sm:champSelectQuitButton',
                    label: t('Enable Champ Select Dodge Button'),
                    value: isEnabled,
                    onChange: (val) => toggleFeature(val)
                },
                {
                    type: 'toggle',
                    id: 'hm:champSelectQuitButton:showPenalty',
                    label: t('Show Dodge Penalty Cost & Lockout Badge'),
                    value: showPenalty,
                    onChange: (val) => {
                        showPenalty = val;
                        Utils.Store.set('champSelectQuitButton', 'showPenalty', val);
                        updateQuitButtonBadge();
                    }
                }
            ]
        });
    } else {
        _domObserverCleanup = Utils.DOM.observer.observe('lol-uikit-scrollable.dodge-button-settings', (plugin) => {
            plugin.appendChild(Utils.Settings.createToggleRow('Enable Dodge Button', isEnabled, (next) => {
                isEnabled = next;
                toggleFeature(isEnabled);
            }));
        });
    }
}

export function load() {
    if (isEnabled) refreshPenaltyInfo();
}

export function unload() {
    for (const cleanup of _hookCleanups) cleanup?.();
    _hookCleanups = [];
    for (const off of _lcuUnsubs) off?.();
    _lcuUnsubs = [];
    if (typeof _domObserverCleanup === 'function') _domObserverCleanup();
    _domObserverCleanup = null;
}
