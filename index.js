/**
 * @name Hex-Manager
 * @version 1.1.0
 * @author Triggered0
 * @description Modular Hextech plugin suite for League of Legends Client
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils from './core/utils.js';
import { init as initI18n } from './core/i18n.js';
import { syncVersionWithMetadata, checkForUpdates } from './core/updater.js';
import { registeredModules, registerModuleConfig, runModuleLifecycle, teardownModules } from './core/registry.js';
import { Modal } from './core/ui/commandCenter.js';
import { TopBar } from './core/ui/topBar.js';

import * as autoAcceptModule from './modules/autoAccept.js';
import * as aramNocdModule from './modules/aramNocd.js';
import * as autoLockChampionModule from './modules/autoLockChampion.js';
import * as champSelectQuitButtonModule from './modules/champSelectQuitButton.js';
import * as balanceTooltipModule from './modules/balanceTooltip.js';
import * as gameAnalysisPopupModule from './modules/gameAnalysisPopup.js';
import * as customOnlineStatusModule from './modules/customOnlineStatus.js';
import * as clientWindowTweaksModule from './modules/clientWindowTweaks.js';
import * as profileTweaksModule from './modules/profileTweaks.js';
import * as autoHonorModule from './modules/autoHonor.js';
import * as arenaGodModule from './modules/arenaGod.js';
import * as whaleHelperModule from './modules/whaleHelper.js';
import * as socialPanelTweaksModule from './modules/socialPanelTweaks.js';
import * as penaltySuppressModule from './modules/penaltySuppress.js';
import * as autoQueueModule from './modules/autoQueue.js';
import * as modeSelectorTweaksModule from './modules/modeSelectorTweaks.js';
import * as nameSpooferModule from './modules/nameSpoofer.js';
import * as useClientDuringGameModule from './modules/useClientDuringGame.js';
import * as autoRuneImporterModule from './modules/autoRuneImporter.js';
import * as betterClientModule from './modules/betterClient.js';
import * as autoReadModule from './modules/autoRead.js';
import * as autoClaimerModule from './modules/autoClaimer.js';
import * as hideUnownedSkinsModule from './modules/hideUnownedSkins.js';
import * as banBlockerModule from './modules/banBlocker.js';
import * as unlockProfileSkinsModule from './modules/unlockProfileSkins.js';

await initI18n();

const MANAGED_MODULES = Object.freeze([
    ['autoAccept', autoAcceptModule],
    ['aramNocd', aramNocdModule],
    ['autoLockChampion', autoLockChampionModule],
    ['champSelectQuitButton', champSelectQuitButtonModule],
    ['SnoozeBalanceTooltip', balanceTooltipModule],
    ['gameAnalysisPopup', gameAnalysisPopupModule],
    ['customOnlineStatus', customOnlineStatusModule],
    ['clientWindowTweaks', clientWindowTweaksModule],
    ['profileTweaks', profileTweaksModule],
    ['autoHonor', autoHonorModule],
    ['arenaGod', arenaGodModule],
    ['socialPanelTweaks', socialPanelTweaksModule],
    ['whaleHelper', whaleHelperModule],
    ['lowPrioWarningSuppress', penaltySuppressModule],
    ['autoQueue', autoQueueModule],
    ['modeSelectorTweaks', modeSelectorTweaksModule],
    ['nameSpoofer', nameSpooferModule],
    ['useClientDuringGame', useClientDuringGameModule],
    ['autoRuneImporter', autoRuneImporterModule],
    ['betterClient', betterClientModule],
    ['autoRead', autoReadModule],
    ['autoClaimer', autoClaimerModule],
    ['hideUnownedSkins', hideUnownedSkinsModule],
    ['banBlocker', banBlockerModule],
    ['unlockProfileSkins', unlockProfileSkinsModule]
]);

let _inited = false;
let _loaded = false;

export { checkForUpdates };

export async function init(ctx) {
    if (_inited) return;
    _inited = true;

    Utils.Store.migrateFromSnooze();
    Utils.Hooks.Ember.install(ctx);
    socialPanelTweaksModule.installEmberHook?.();
    whaleHelperModule.installEmberHook?.();
    modeSelectorTweaksModule.installEmberHook?.();
    Utils.LCU.bind(ctx);

    try {
        Utils.Debug.setEnabled(Utils.Store.get('core', 'debugLogs') === true);
    } catch (_) {}

    const managerApi = {
        init, load, unload, __isLoader: true,
        show: () => Modal.show(),
        hide: () => Modal.hide(),
        toggle: () => Modal.toggle(),
        showHistory: async (puuid, tag = '') => {
            try {
                const p = await Utils.LCU.get('/lol-summoner/v2/summoners/puuid/' + puuid);
                if (p) gameAnalysisPopupModule.MatchHistoryModal.show(p, tag);
            } catch (_) {}
        },
        registerModule: registerModuleConfig
    };

    window.HexManager = managerApi;
    window.SnoozeManager = managerApi;
    await runModuleLifecycle(MANAGED_MODULES, 'init', [ctx]);
}

export async function load(context) {
    const gateOnClientReady = () => {
        const rcp = (context && context.rcp) || window.rcp;
        if (rcp && typeof rcp.whenReady === 'function') {
            rcp.whenReady('rcp-fe-lol-social').then(() => checkForUpdates(), () => checkForUpdates());
        } else {
            checkForUpdates();
        }
    };

    if (_loaded) {
        gateOnClientReady();
        return;
    }
    _loaded = true;
    await Utils.GameData.Assets.init();
    Modal.init();
    TopBar.init(() => Modal.toggle());
    await syncVersionWithMetadata();
    gateOnClientReady();
    await runModuleLifecycle(MANAGED_MODULES, 'load');
}

export async function unload() {
    if (!_inited && !_loaded) return;
    await teardownModules(MANAGED_MODULES);
    TopBar.destroy();
    Modal.destroy();
    Utils.Panic.uninstall();
    Utils.DOM.observer.disconnect();
    Utils.LCU.unbind();
    registeredModules.length = 0;
    if (window.HexManager?.unload === unload) delete window.HexManager;
    if (window.SnoozeManager?.unload === unload) delete window.SnoozeManager;
    _loaded = false;
    _inited = false;
}
