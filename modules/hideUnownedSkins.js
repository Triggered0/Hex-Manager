/**
 * @name Hex-HideUnownedSkins
 * @version 1.1.0
 * @author Triggered0
 * @description Filters the Champion Select skin carousel so only owned skins (plus base skin) are displayed.
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils, { t } from '../core/utils.js';

const CHAMP_SELECT_PLUGIN = 'rcp-fe-lol-champ-select';
const CAROUSEL_PATH = '/lol-champ-select/v1/skin-carousel-skins';

let bindingHandle = null;

function isSkinUsable(skin) {
    return Boolean(skin) && (skin.unlocked === true || skin.awUnlocked === true || skin.ownership?.owned === true);
}

function filterOwnedOnly(skins) {
    if (!Array.isArray(skins)) return skins;
    const kept = [];
    for (const skin of skins) {
        if (!skin || typeof skin !== 'object') continue;
        if (!skin.isBase && !isSkinUsable(skin)) continue;
        if (Array.isArray(skin.childSkins) && skin.childSkins.some((child) => !isSkinUsable(child))) {
            kept.push({ ...skin, childSkins: skin.childSkins.filter(isSkinUsable) });
        } else {
            kept.push(skin);
        }
    }
    return kept;
}

function enableHideUnowned() {
    if (bindingHandle) return;
    bindingHandle = Utils.Hooks.DataBinding.transformBinding({
        identifier: CHAMP_SELECT_PLUGIN,
        match: (path) => path === CAROUSEL_PATH,
        transform: filterOwnedOnly
    });
}

function disableHideUnowned() {
    bindingHandle?.dispose();
    bindingHandle = null;
}

export function init() {
    const enabled = Utils.Store.get('hideUnownedSkins', 'enabled', false) === true;

    if (window.HexManager && window.HexManager.registerModule) {
        window.HexManager.registerModule({
            id: 'hideUnownedSkins',
            name: t('Hide Unowned Skins'),
            description: t('In Champion Select, filters the skin carousel to only show skins you own for the picked champion.'),
            settings: [
                {
                    type: 'toggle',
                    id: 'hm:hideUnownedSkins:enabled',
                    label: t('Enable Hide Unowned Skins'),
                    value: enabled,
                    onChange: (val) => {
                        Utils.Store.set('hideUnownedSkins', 'enabled', val);
                        if (val) enableHideUnowned();
                        else disableHideUnowned();
                    }
                }
            ]
        });
    }
}

export function load() {
    if (Utils.Store.get('hideUnownedSkins', 'enabled', false) === true) {
        enableHideUnowned();
    }
}

export function unload() {
    disableHideUnowned();
}
