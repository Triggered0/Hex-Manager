/**
 * @name Hex-BetterClient
 * @version 1.1.0
 * @author Triggered0
 * @description Blocks client telemetry, pauses invisible media, and optimizes performance during matches.
 * @link https://github.com/Triggered0/Hex-Manager
 */
import Utils, { t } from '../core/utils.js';

const PHASE_URI = '/lol-gameflow/v1/gameflow-phase';
const TELEMETRY_LOCAL = /^\/(?:telemetry\/|lol-telemetry\/|tracing\/v1\/|riotclient\/addorupdatemetric|lol-rms\/v1\/telemetry|error-monitor\/v1\/ux-logs)/i;
const TELEMETRY_HOST = /(^|\.)(?:datadoghq\.(?:com|eu)|datadog-?intake\.\w+|sentry\.io|bugsnag\.com|browser-intake[\w.-]*|google-analytics\.com|googletagmanager\.com|doubleclick\.net|segment\.io|mixpanel\.com|amplitude\.com)$/i;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const DECISION_LIMIT = 512;
const SWEEP_MS = 15000;

const BACKGROUND_CLASS = 'hm-bc-background';
const LITE_CLASS = 'hm-bc-lite';
const STYLE_ID = 'hm-better-client-style';
const CSS = `
html.${BACKGROUND_CLASS} *, html.${BACKGROUND_CLASS} *::before, html.${BACKGROUND_CLASS} *::after {
  animation-play-state: paused !important;
}
html.${LITE_CLASS} *, html.${LITE_CLASS} *::before, html.${LITE_CLASS} *::after {
  animation-duration: 1ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
}`;

let active = false;
let phase = 'None';
let backgroundMode = true;
let liteMode = false;
let unsubscribePhase = null;
let restores = [];
const decisions = new Map();
const held = new WeakSet();
const tracked = new Set();
let mediaObserver = null;

function isBlocked(raw) {
    const text = typeof raw === 'string' ? raw : raw?.url ?? raw?.href ?? String(raw ?? '');
    const known = decisions.get(text);
    if (known !== undefined) return known;
    let verdict = false;
    if (text.startsWith('/') && !text.startsWith('//')) {
        verdict = TELEMETRY_LOCAL.test(text);
    } else {
        try {
            const url = new URL(text, location.href);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                verdict = LOCAL_HOSTS.has(url.hostname) ? TELEMETRY_LOCAL.test(url.pathname) : TELEMETRY_HOST.test(url.hostname);
            }
        } catch (_) {}
    }
    if (decisions.size >= DECISION_LIMIT) decisions.clear();
    decisions.set(text, verdict);
    return verdict;
}

function installFetch() {
    const native = window.fetch;
    const patched = function(input, init) {
        if (active && isBlocked(typeof input === 'string' ? input : input?.url ?? '')) {
            return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return native.call(this, input, init);
    };
    window.fetch = patched;
    return () => {
        if (window.fetch === patched) window.fetch = native;
    };
}

function finishBlockedXhr(xhr) {
    try {
        Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
        Object.defineProperty(xhr, 'status', { configurable: true, get: () => 200 });
        Object.defineProperty(xhr, 'statusText', { configurable: true, get: () => 'OK' });
        Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => '{}' });
        Object.defineProperty(xhr, 'response', { configurable: true, get: () => (xhr.responseType === 'json' ? {} : '{}') });
        Object.defineProperty(xhr, 'getAllResponseHeaders', { configurable: true, value: () => 'content-type: application/json\r\n' });
        Object.defineProperty(xhr, 'getResponseHeader', { configurable: true, value: (name) => (/content-type/i.test(name) ? 'application/json' : null) });
    } catch (_) {}
    setTimeout(() => {
        for (const type of ['readystatechange', 'load', 'loadend']) {
            try {
                xhr.dispatchEvent(new Event(type));
            } catch (_) {}
        }
    }, 0);
}

function installXhr() {
    const proto = XMLHttpRequest.prototype;
    const nativeOpen = proto.open;
    const nativeSend = proto.send;
    const open = function(method, url, ...rest) {
        this.__hmBcUrl = url;
        return nativeOpen.call(this, method, url, ...rest);
    };
    const send = function(body) {
        if (active && this.__hmBcUrl !== undefined && isBlocked(String(this.__hmBcUrl))) {
            finishBlockedXhr(this);
            return undefined;
        }
        return nativeSend.call(this, body);
    };
    proto.open = open;
    proto.send = send;
    return () => {
        if (proto.open === open) proto.open = nativeOpen;
        if (proto.send === send) proto.send = nativeSend;
    };
}

function installBeacon() {
    const nav = window.navigator;
    if (typeof nav?.sendBeacon !== 'function') return () => {};
    const native = nav.sendBeacon;
    const patched = function(url, data) {
        if (active && isBlocked(String(url))) return true;
        return native.call(this, url, data);
    };
    nav.sendBeacon = patched;
    return () => {
        if (nav.sendBeacon === patched) nav.sendBeacon = native;
    };
}

function quietDatadog() {
    try {
        window.DD_RUM?.setTrackingConsent?.('not-granted');
    } catch (_) {}
    return () => {
        try {
            window.DD_RUM?.setTrackingConsent?.('granted');
        } catch (_) {}
    };
}

function inBackground() {
    return backgroundMode && phase === 'InProgress' && !document.hasFocus();
}

function lottieOf(element) {
    return element.tagName === 'LOL-UIKIT-LOTTIE' ? element.animation ?? null : null;
}

function isLoop(element) {
    return element.tagName === 'VIDEO' ? element.loop : lottieOf(element)?.loop === true;
}

function isPlaying(element) {
    if (element.tagName === 'VIDEO') return !element.paused;
    const animation = lottieOf(element);
    return Boolean(animation) && animation.isPaused === false;
}

function rendered(element) {
    return element.isConnected && element.getClientRects().length > 0;
}

function shouldHold(element, visible = rendered(element)) {
    return !visible || inBackground() || (liteMode && isLoop(element));
}

function hold(element) {
    if (!isPlaying(element)) return;
    try {
        if (element.tagName === 'VIDEO') element.pause();
        else lottieOf(element)?.pause();
        held.add(element);
    } catch (_) {}
}

function release(element) {
    if (!held.has(element)) return;
    held.delete(element);
    if (!element.isConnected) return;
    try {
        if (element.tagName === 'VIDEO') {
            if (element.loop || !element.ended) element.play()?.catch?.(() => {});
        } else {
            lottieOf(element)?.play();
        }
    } catch (_) {}
}

function settle(element, visible) {
    if (shouldHold(element, visible)) hold(element);
    else release(element);
}

function onMediaPlay(event) {
    const element = event.target;
    if (shouldHold(element)) queueMicrotask(() => shouldHold(element) && hold(element));
}

function track(element) {
    if (tracked.has(element)) return;
    tracked.add(element);
    if (element.tagName === 'VIDEO') element.addEventListener('play', onMediaPlay);
    mediaObserver?.observe(element);
}

function untrack(element) {
    mediaObserver?.unobserve(element);
    element.removeEventListener('play', onMediaPlay);
    tracked.delete(element);
}

function settleAll() {
    for (const element of tracked) {
        if (element.isConnected) settle(element);
    }
}

function installMediaGovernor() {
    mediaObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) settle(entry.target, entry.isIntersecting);
        },
        { rootMargin: '64px' }
    );
    const unwatch = Utils.DOM.observer.observe('video, lol-uikit-lottie', track);
    const sweeper = setInterval(() => {
        for (const element of tracked) {
            if (!element.isConnected) untrack(element);
            else if (element.tagName !== 'VIDEO' && isPlaying(element) && shouldHold(element)) hold(element);
        }
    }, SWEEP_MS);

    return () => {
        clearInterval(sweeper);
        unwatch?.();
        mediaObserver?.disconnect();
        mediaObserver = null;
        for (const element of [...tracked]) {
            untrack(element);
            if (rendered(element)) release(element);
        }
    };
}

function applyModes() {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle(BACKGROUND_CLASS, active && inBackground());
    root.classList.toggle(LITE_CLASS, active && liteMode);
    settleAll();
}

function installModes() {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
    }
    window.addEventListener('focus', applyModes);
    window.addEventListener('blur', applyModes);
    document.addEventListener('visibilitychange', applyModes);
    return () => {
        window.removeEventListener('focus', applyModes);
        window.removeEventListener('blur', applyModes);
        document.removeEventListener('visibilitychange', applyModes);
        document.documentElement?.classList.remove(BACKGROUND_CLASS, LITE_CLASS);
        styleEl?.remove();
    };
}

function onPhase(raw) {
    const next = typeof raw === 'string' ? raw : raw?.data;
    if (typeof next !== 'string' || !next || next === phase) return;
    phase = next;
    applyModes();
}

function startBetterClient() {
    if (active) return;
    active = true;
    backgroundMode = Utils.Store.get('betterClient', 'backgroundMode', true) !== false;
    liteMode = Utils.Store.get('betterClient', 'performanceMode', false) === true;
    restores = [
        installFetch(),
        installXhr(),
        installBeacon(),
        quietDatadog(),
        installModes(),
        installMediaGovernor()
    ];
    unsubscribePhase = Utils.LCU.observe(PHASE_URI, onPhase);
    Utils.LCU.get(PHASE_URI).then(onPhase).catch(() => {});
    applyModes();
}

function stopBetterClient() {
    if (!active) return;
    active = false;
    unsubscribePhase?.();
    unsubscribePhase = null;
    for (const restore of restores.reverse()) {
        try {
            restore();
        } catch (_) {}
    }
    restores = [];
    decisions.clear();
    phase = 'None';
}

export function init() {
    const enabled = Utils.Store.get('betterClient', 'enabled', false) === true;
    backgroundMode = Utils.Store.get('betterClient', 'backgroundMode', true) !== false;
    liteMode = Utils.Store.get('betterClient', 'performanceMode', false) === true;

    if (window.HexManager && window.HexManager.registerModule) {
        window.HexManager.registerModule({
            id: 'betterClient',
            name: t('BetterClient'),
            description: t('Blocks telemetry & tracking, pauses invisible animations, and reduces CPU/GPU usage while in game.'),
            settings: [
                {
                    type: 'toggle',
                    id: 'hm:betterClient:enabled',
                    label: t('Enable BetterClient'),
                    value: enabled,
                    onChange: (val) => {
                        Utils.Store.set('betterClient', 'enabled', val);
                        if (val) startBetterClient();
                        else stopBetterClient();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:betterClient:backgroundMode',
                    label: t('Pause Client While Playing'),
                    value: backgroundMode,
                    onChange: (val) => {
                        backgroundMode = val;
                        Utils.Store.set('betterClient', 'backgroundMode', val);
                        applyModes();
                    }
                },
                {
                    type: 'toggle',
                    id: 'hm:betterClient:performanceMode',
                    label: t('Performance Mode (Disable Blur & Animations)'),
                    value: liteMode,
                    onChange: (val) => {
                        liteMode = val;
                        Utils.Store.set('betterClient', 'performanceMode', val);
                        applyModes();
                    }
                }
            ]
        });
    }
}

export function load() {
    if (Utils.Store.get('betterClient', 'enabled', false) === true) {
        startBetterClient();
    }
}

export function unload() {
    stopBetterClient();
}
