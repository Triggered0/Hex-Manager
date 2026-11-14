/**
 * @name Hex-AutoClaimer
 * @version 1.1.0
 * @author Triggered0
 * @description Automatically claims event track, mission, and TFT Battle Pass rewards, plus optional 1 BE store items and loot opening.
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils, { t } from '../core/utils.js';

const SWEEP_DEBOUNCE_MS = 400;
const CLAIM_COOLDOWN_MS = 5 * 60 * 1000;
const BUY_COOLDOWN_MS = 30 * 60 * 1000;
const SHOP_THROTTLE_MS = 60 * 1000;
const BUY_FALLBACK_MS = 15 * 60 * 1000;
const MAX_ACTIONS_PER_SWEEP = 25;

const EVENTS_URI = '/lol-event-hub/v1/events';
const MISSIONS_URI = '/lol-missions/v1/missions';
const TFT_PASS_URI = '/lol-tft-pass/v1/battle-pass';
const TFT_PASSES_URI = '/lol-tft-pass/v1/active-passes';
const LOOT_URI = '/lol-loot/v1/player-loot';
const STORE_READY_URI = '/lol-store/v1/store-ready';
const CATALOG_URI = '/lol-store/v1/catalog';
const BUY_URI = '/lol-purchase-widget/v2/purchaseItems';

let active = false;
let claimTimer = null;
let claimRunning = false;
let claimQueued = false;
let shopDebounce = null;
let shopInterval = null;
let shopRunning = false;
let shopQueued = false;
let unsubscribes = [];
const cooldowns = new Map();
const recipes = new Map();

function isOptEnabled(key) {
    return Utils.Store.get('autoClaimer', key, false) === true;
}

function ready(key, wait) {
    return (cooldowns.get(key) ?? 0) + wait <= Date.now();
}

function stamp(key) {
    cooldowns.set(key, Date.now());
}

function getJson(path) {
    return fetch(path, { headers: { Accept: 'application/json' } }).then((response) => {
        if (!response.ok) throw new Error(`${path} responded ${response.status}`);
        return response.json();
    });
}

function sendJson(method, path, body) {
    return fetch(path, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    }).then((response) => {
        if (!response.ok) throw new Error(`${method} ${path} responded ${response.status}`);
        return response.status === 204 ? null : response.json().catch(() => null);
    });
}

async function sweepEvents() {
    const events = await getJson(EVENTS_URI);
    if (!Array.isArray(events)) return;
    for (const entry of events) {
        const id = entry?.eventId;
        const unclaimed = entry?.eventInfo?.unclaimedRewardCount ?? 0;
        if (!id || unclaimed <= 0 || !ready(`event:${id}`, CLAIM_COOLDOWN_MS)) continue;
        stamp(`event:${id}`);
        await sendJson('POST', `${EVENTS_URI}/${id}/reward-track/claim-all`).catch(() => {});
    }
}

async function sweepMissions() {
    const missions = await getJson(MISSIONS_URI);
    if (!Array.isArray(missions)) return;
    for (const mission of missions) {
        if (mission?.status !== 'SELECT_REWARDS') continue;
        const id = mission.id;
        if (!id || !ready(`mission:${id}`, CLAIM_COOLDOWN_MS)) continue;
        const rewards = Array.isArray(mission.rewards) ? mission.rewards : [];
        const groups = [...new Set(rewards.map((reward) => reward?.rewardGroup).filter((group) => group != null && group !== ''))];
        if (groups.length === 0) continue;
        if (groups.length > 1 && (mission.rewardStrategy?.selectMaxGroupCount ?? 0) > 0) continue;
        stamp(`mission:${id}`);
        await sendJson('PUT', `/lol-missions/v1/player/${id}`, { rewardGroups: [groups[0]] }).catch(() => {});
    }
}

async function sweepTftPasses() {
    const seen = new Set();
    for (const uri of [TFT_PASS_URI, TFT_PASSES_URI]) {
        const data = await getJson(uri).catch(() => null);
        const passes = Array.isArray(data) ? data : data ? [data] : [];
        for (const pass of passes) {
            const passId = pass?.info?.passId;
            if (!passId || seen.has(passId)) continue;
            seen.add(passId);
            const milestones = [...(Array.isArray(pass.milestones) ? pass.milestones : []), ...(Array.isArray(pass.bonuses) ? pass.bonuses : [])];
            const claimable = milestones.some(
                (m) => m && !m.isLocked && !m.isClaimRequestPending && (m.status === 'REWARDABLE' || m.status === 'CLAIMABLE')
            );
            if (!claimable || !ready(`tftpass:${passId}`, CLAIM_COOLDOWN_MS)) continue;
            stamp(`tftpass:${passId}`);
            await sendJson('PUT', `/lol-tft-pass/v1/pass/${passId}/milestone/claimAllRewards`).catch(() => {});
        }
    }
}

function recipeFor(lootId) {
    if (!recipes.has(lootId)) {
        const promise = getJson(`/lol-loot/v1/recipes/initial-item/${encodeURIComponent(lootId)}`)
            .then((list) => (Array.isArray(list) ? (list.find((entry) => entry?.type === 'OPEN' && entry.recipeName) ?? null) : null))
            .catch(() => {
                recipes.delete(lootId);
                return null;
            });
        recipes.set(lootId, promise);
    }
    return recipes.get(lootId);
}

async function sweepLoot() {
    const loot = await getJson(LOOT_URI);
    if (!Array.isArray(loot)) return;
    const owned = new Map();
    for (const item of loot) {
        if (item?.lootId) owned.set(item.lootId, item.count ?? 0);
    }
    let actions = 0;
    for (const item of loot) {
        if (actions >= MAX_ACTIONS_PER_SWEEP) break;
        const lootId = item?.lootId;
        const count = item?.count ?? 0;
        if (!lootId || count <= 0 || /^(CURRENCY|MATERIAL)_/.test(lootId)) continue;
        if (!ready(`loot:${lootId}`, CLAIM_COOLDOWN_MS)) continue;
        const recipe = await recipeFor(lootId);
        if (!recipe) continue;
        const isChest = item.type === 'CHEST' || /CHEST/i.test(lootId) || /CHEST/i.test(recipe.displayCategories ?? '');
        if (!isOptEnabled('openLoot') || !(isChest ? isOptEnabled('openChests') : isOptEnabled('openMystery'))) continue;
        const slots = Array.isArray(recipe.slots) ? recipe.slots : [];
        const body = [];
        let repeat = count;
        let blocked = false;
        for (const slot of slots) {
            const candidates = Array.isArray(slot?.lootIds) ? slot.lootIds : [];
            const match = candidates.find((id) => (owned.get(id) ?? 0) > 0);
            if (!match) {
                blocked = true;
                break;
            }
            body.push(match);
            repeat = Math.min(repeat, Math.floor((owned.get(match) ?? 0) / Math.max(1, slot.quantity ?? 1)));
        }
        if (blocked || body.length === 0 || repeat <= 0) continue;
        repeat = Math.min(repeat, 25);
        stamp(`loot:${lootId}`);
        actions++;
        for (let i = 0; i < body.length; i++) {
            owned.set(body[i], (owned.get(body[i]) ?? 0) - repeat * (slots[i].quantity ?? 1));
        }
        await sendJson('POST', `/lol-loot/v1/recipes/${encodeURIComponent(recipe.recipeName)}/craft?repeat=${repeat}`, body).catch(() => {});
    }
}

async function isOwned(inventoryType, itemId) {
    if (!inventoryType || itemId == null) return null;
    const list = await getJson(`/lol-inventory/v2/inventory/${encodeURIComponent(inventoryType)}`).catch(() => null);
    if (!Array.isArray(list)) return null;
    return list.some((entry) => entry?.itemId === itemId);
}

async function runShop() {
    if (!active || shopRunning) {
        if (shopRunning) shopQueued = true;
        return;
    }
    if (!isOptEnabled('buy1Be') || !ready('shop-catalog', SHOP_THROTTLE_MS)) return;
    shopRunning = true;
    stamp('shop-catalog');
    try {
        const catalog = await getJson(CATALOG_URI);
        if (!Array.isArray(catalog)) return;
        const cheap = catalog.filter(
            (item) =>
                item?.active === true &&
                Array.isArray(item.prices) &&
                item.prices.some((price) => price?.cost === 1 && price?.currency === 'IP')
        );
        for (const item of cheap) {
            const key = `buy:${item.inventoryType}:${item.itemId}`;
            if (!ready(key, BUY_COOLDOWN_MS)) continue;
            const owned = await isOwned(item.inventoryType, item.itemId);
            if (owned === null) continue;
            stamp(key);
            if (owned) continue;
            await sendJson('POST', BUY_URI, {
                items: [
                    {
                        itemKey: { itemId: item.itemId, inventoryType: item.inventoryType },
                        purchaseCurrencyInfo: { currencyType: 'IP', price: 1, purchasable: true },
                        source: 'store',
                        featuredSection: '',
                        quantity: 1
                    }
                ]
            }).catch(() => {});
        }
    } finally {
        shopRunning = false;
        if (shopQueued) {
            shopQueued = false;
            scheduleShop();
        }
    }
}

function scheduleClaims() {
    if (!active) return;
    clearTimeout(claimTimer);
    claimTimer = setTimeout(runClaims, SWEEP_DEBOUNCE_MS);
}

function scheduleShop() {
    if (!active || !isOptEnabled('buy1Be')) return;
    clearTimeout(shopDebounce);
    shopDebounce = setTimeout(runShop, SWEEP_DEBOUNCE_MS);
}

async function runClaims() {
    if (!active) return;
    if (claimRunning) {
        claimQueued = true;
        return;
    }
    claimRunning = true;
    try {
        await sweepEvents().catch(() => {});
        await sweepMissions().catch(() => {});
        await sweepTftPasses().catch(() => {});
        if (isOptEnabled('openLoot') && (isOptEnabled('openMystery') || isOptEnabled('openChests'))) {
            await sweepLoot().catch(() => {});
        }
    } finally {
        claimRunning = false;
        if (claimQueued) {
            claimQueued = false;
            scheduleClaims();
        }
    }
}

function syncShopTimer() {
    if (active && isOptEnabled('buy1Be')) {
        if (!shopInterval) shopInterval = setInterval(scheduleShop, BUY_FALLBACK_MS);
        scheduleShop();
        return;
    }
    clearInterval(shopInterval);
    clearTimeout(shopDebounce);
    shopInterval = null;
}

function startAutoClaimer() {
    if (active) return;
    active = true;
    cooldowns.clear();
    recipes.clear();
    const claimPush = () => scheduleClaims();
    const shopPush = () => {
        if (isOptEnabled('buy1Be')) scheduleShop();
    };
    for (const uri of [EVENTS_URI, MISSIONS_URI, TFT_PASS_URI, TFT_PASSES_URI, LOOT_URI]) {
        try {
            const off = Utils.LCU.observe(uri, claimPush);
            if (off) unsubscribes.push(off);
        } catch (_) {}
    }
    try {
        const off = Utils.LCU.observe(STORE_READY_URI, shopPush);
        if (off) unsubscribes.push(off);
    } catch (_) {}
    scheduleClaims();
    syncShopTimer();
}

function stopAutoClaimer() {
    if (!active) return;
    active = false;
    clearTimeout(claimTimer);
    clearTimeout(shopDebounce);
    clearInterval(shopInterval);
    claimTimer = null;
    shopDebounce = null;
    shopInterval = null;
    claimRunning = false;
    claimQueued = false;
    shopRunning = false;
    shopQueued = false;
    for (const off of unsubscribes) {
        try {
            off();
        } catch (_) {}
    }
    unsubscribes = [];
    cooldowns.clear();
    recipes.clear();
}

export function init() {
    const enabled = Utils.Store.get('autoClaimer', 'enabled', false) === true;

    if (window.HexManager && window.HexManager.registerModule) {
        window.HexManager.registerModule({
            id: 'autoClaimer',
            name: t('Auto Claimer'),
            description: t('Automatically claims Event Hub, Mission, and TFT Battle Pass rewards, plus optional 1 BE store items and loot opening.'),
            settings: [
                {
                    type: 'toggle',
                    id: 'hm:autoClaimer:enabled',
                    label: t('Enable Auto Claimer'),
                    value: enabled,
                    onChange: (val) => {
                        Utils.Store.set('autoClaimer', 'enabled', val);
                        if (val) startAutoClaimer();
                        else stopAutoClaimer();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:autoClaimer:buy1Be',
                    label: t('Auto-Buy 1 BE Store Items'),
                    value: isOptEnabled('buy1Be'),
                    onChange: (val) => {
                        Utils.Store.set('autoClaimer', 'buy1Be', val);
                        if (active) syncShopTimer();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:autoClaimer:openLoot',
                    label: t('Auto-Open Craftable Loot'),
                    value: isOptEnabled('openLoot'),
                    onChange: (val) => {
                        Utils.Store.set('autoClaimer', 'openLoot', val);
                        if (active && val) scheduleClaims();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:autoClaimer:openMystery',
                    label: t('Include Mystery Items (Icons, Wards, Emotes, Skins)'),
                    value: isOptEnabled('openMystery'),
                    onChange: (val) => {
                        Utils.Store.set('autoClaimer', 'openMystery', val);
                        if (active && val) scheduleClaims();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:autoClaimer:openChests',
                    label: t('Include Hextech Chests (When Key Available)'),
                    value: isOptEnabled('openChests'),
                    onChange: (val) => {
                        Utils.Store.set('autoClaimer', 'openChests', val);
                        if (active && val) scheduleClaims();
                    }
                }
            ]
        });
    }
}

export function load() {
    if (Utils.Store.get('autoClaimer', 'enabled', false) === true) {
        startAutoClaimer();
    }
}

export function unload() {
    stopAutoClaimer();
}
