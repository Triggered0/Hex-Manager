import Utils from './utils.js';
import { t } from './i18n.js';

export const registeredModules = [];

export const DEFAULT_MENU_HOTKEY = {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    code: 'F1',
    display: 'F1'
};

export function getMenuHotkey() {
    const stored = Utils.Store.get('core', 'hotkeyObj');
    if (stored && typeof stored === 'object') return stored;

    const legacy = Utils.Store.get('core', 'hotkey');
    if (typeof legacy === 'string') {
        return {
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            code: legacy,
            display: legacy
        };
    }

    return { ...DEFAULT_MENU_HOTKEY };
}

export function getDisabledModuleIds() {
    const v = Utils.Store.get('core', 'disabledModules');
    return Array.isArray(v) ? new Set(v) : new Set();
}

export function getModuleInfo() {
    return {
        autoAccept: { name: t('Auto Accept') },
        aramNocd: { name: t('ARAM No CD') },
        autoLockChampion: { name: t('Auto Lock Champion') },
        champSelectQuitButton: { name: t('Champ Select Quit Button') },
        SnoozeBalanceTooltip: { name: t('Mode Balance Info') },
        gameAnalysisPopup: { name: t('Game Analysis Popup') },
        customOnlineStatus: { name: t('Custom Online Status') },
        clientWindowTweaks: { name: t('Client Window Tweaks') },
        profileTweaks: { name: t('Profile Tweaks') },
        autoHonor: { name: t('Auto Honor') },
        arenaGod: { name: t('Arena God') },
        socialPanelTweaks: { name: t('Social Panel Tweaks') },
        whaleHelper: { name: t('Whales Helper') },
        lowPrioWarningSuppress: { name: t('Low Prio Warning Suppress') },
        autoQueue: { name: t('Auto Queue') },
        modeSelectorTweaks: { name: t('Mode Selector Tweaks') },
        nameSpoofer: { name: t('Name Spoofer') },
        useClientDuringGame: { name: t('Use Client In Game') },
        autoRuneImporter: { name: t('Auto Rune & Spells') }
    };
}

export function registerModuleConfig(config) {
    const existingIndex = registeredModules.findIndex(module => module.id === config.id);
    if (existingIndex >= 0) registeredModules[existingIndex] = config;
    else registeredModules.push(config);
    Utils.Debug.log(`[Hex-Manager] Registered module: ${config.name}`);
}

export async function runModuleLifecycle(managedModules, method, args = []) {
    const disabledIds = getDisabledModuleIds();
    for (const [id, module] of managedModules) {
        if (disabledIds.has(id) || typeof module[method] !== 'function') continue;
        try {
            await module[method](...args);
        } catch (error) {
            Utils.Debug.error(`[Hex-Manager] ${id}.${method} failed:`, error);
        }
    }
}

export async function teardownModules(managedModules) {
    for (const [id, module] of [...managedModules].reverse()) {
        const cleanup = typeof module.unload === 'function' ? module.unload : module.dispose;
        if (typeof cleanup !== 'function') continue;
        try {
            await cleanup();
        } catch (error) {
            Utils.Debug.error(`[Hex-Manager] ${id} cleanup failed:`, error);
        }
    }
}
