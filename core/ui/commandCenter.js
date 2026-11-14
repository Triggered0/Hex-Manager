import Utils from '../utils.js';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, t } from '../i18n.js';
import { checkForUpdates, getCurrentVersion, getLatestRelease, setUpdateBadgeCallback } from '../updater.js';
import { registeredModules, getDisabledModuleIds, getModuleInfo, getMenuHotkey } from '../registry.js';
import { STYLE_CONTENT } from './theme.js';

const CATEGORY_DEFINITIONS = [
    {
        id: 'cat-lobby',
        titleKey: 'Lobby & Queue',
        subtitleKey: 'Matchmaking automation, custom lobbies, and queue controls.',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>',
        moduleIds: ['autoAccept', 'autoQueue', 'modeSelectorTweaks', 'lowPrioWarningSuppress', 'useClientDuringGame']
    },
    {
        id: 'cat-champ-select',
        titleKey: 'Champ Select',
        subtitleKey: 'Dodge button, automatic runes/spells/items, pick/ban lock, and balance info.',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L19 7V17L12 22L5 17V7L12 2Z"/><circle cx="12" cy="12" r="3"/></svg>',
        moduleIds: ['champSelectQuitButton', 'autoRuneImporter', 'autoLockChampion', 'aramNocd', 'SnoozeBalanceTooltip']
    },
    {
        id: 'cat-match',
        titleKey: 'Match & Honor',
        subtitleKey: 'Live lobby/game player analysis, post-game auto honor, and Arena progression.',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>',
        moduleIds: ['gameAnalysisPopup', 'autoHonor', 'arenaGod']
    },
    {
        id: 'cat-profile',
        titleKey: 'Profile & Client',
        subtitleKey: 'Profile rank/background spoofing, custom status, social roster, loot, and window sizing.',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        moduleIds: ['profileTweaks', 'customOnlineStatus', 'socialPanelTweaks', 'nameSpoofer', 'clientWindowTweaks', 'whaleHelper']
    }
];

export const Modal = (function() {
    let _root = null;
    let _visible = false;
    let _keydownHandler = null;
    const _cbs = new Set();

    function getHiddenModuleIds() {
        const v = Utils.Store.get('core', 'hiddenModules');
        return Array.isArray(v) ? new Set(v) : new Set();
    }

    function isModuleEnabled(mod) {
        return (mod.settings || []).some(s => s.type === 'toggle' && s.value === true);
    }

    function create() {
        const old = document.getElementById('pm-root');
        if (old) old.remove();

        const styleId = 'pm-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = STYLE_CONTENT;
            document.head.appendChild(style);
        }

        _root = document.createElement('div');
        _root.id = 'pm-root';

        const overlay = document.createElement('div');
        overlay.id = 'pm-overlay';
        overlay.addEventListener('click', () => hide());

        const modal = document.createElement('div');
        modal.id = 'pm-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'pm-header';

        const brandGroup = document.createElement('div');
        brandGroup.className = 'hm-brand-group';
        brandGroup.innerHTML = `
            <span class="hm-brand-crest">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="#c8aa6e" stroke-width="1.8"/>
                    <path d="M12 6.5L16.5 9.25V14.75L12 17.5L7.5 14.75V9.25L12 6.5Z" fill="#c8aa6e" fill-opacity="0.25" stroke="#c8aa6e" stroke-width="1.2"/>
                </svg>
            </span>
            <h2 class="pm-title">${t("HEX MANAGER")}</h2>
        `;

        const activeBadge = document.createElement('span');
        activeBadge.className = 'hm-active-badge';
        brandGroup.appendChild(activeBadge);

        const searchWrap = document.createElement('div');
        searchWrap.className = 'hm-header-search-wrap';
        searchWrap.innerHTML = `
            <span class="hm-header-search-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
        `;
        const modSearchInput = document.createElement('input');
        modSearchInput.id = 'hm-mod-search';
        modSearchInput.type = 'text';
        modSearchInput.placeholder = t('Filter modules & settings...');
        searchWrap.appendChild(modSearchInput);

        const headerRight = document.createElement('div');
        headerRight.className = 'hm-header-right';

        const hotkeyPill = document.createElement('span');
        hotkeyPill.className = 'hm-hotkey-pill';
        hotkeyPill.textContent = getMenuHotkey()?.display || 'F1';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'pm-close';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => hide());

        headerRight.appendChild(hotkeyPill);
        headerRight.appendChild(closeBtn);

        header.appendChild(brandGroup);
        header.appendChild(searchWrap);
        header.appendChild(headerRight);
        modal.appendChild(header);

        const body = document.createElement('div');
        body.className = 'pm-body';

        const sidebar = document.createElement('div');
        sidebar.className = 'pm-sidebar';

        const content = document.createElement('div');
        content.className = 'pm-content';

        body.appendChild(sidebar);
        body.appendChild(content);
        modal.appendChild(body);

        let activeTabId = 'cat-lobby';
        const categoryBadges = new Map();

        function updateCounters() {
            const validMods = registeredModules.filter(m => m.settings && m.settings.length > 0);
            const activeTotal = validMods.filter(isModuleEnabled).length;
            activeBadge.textContent = `${activeTotal}/${validMods.length} ${t('Active')}`;

            for (const cat of CATEGORY_DEFINITIONS) {
                const badgeEl = categoryBadges.get(cat.id);
                if (!badgeEl) continue;
                const catMods = validMods.filter(m => cat.moduleIds.includes(m.id));
                const enabledCount = catMods.filter(isModuleEnabled).length;
                badgeEl.textContent = `${enabledCount}/${catMods.length}`;
            }
        }

        function switchTab(tabId) {
            activeTabId = tabId;
            sidebar.querySelectorAll('.pm-tab').forEach(el => el.classList.remove('active'));
            content.querySelectorAll('.pm-tab-content').forEach(el => el.classList.remove('active'));

            const tab = sidebar.querySelector(`[data-target="${tabId}"]`);
            const tabContent = content.querySelector(`#${tabId}`);
            if (tab) tab.classList.add('active');
            if (tabContent) tabContent.classList.add('active');
        }

        function createSidebarTab({ id, title, iconHtml, countBadge = false, isActive = false, extraClass = '', onClick }) {
            const tab = document.createElement('div');
            tab.className = 'pm-tab' + (isActive ? ' active' : '') + (extraClass ? ' ' + extraClass : '');
            tab.setAttribute('data-target', id);

            const left = document.createElement('div');
            left.className = 'hm-tab-left';
            left.innerHTML = `<span class="hm-tab-icon">${iconHtml}</span><span>${title}</span>`;
            tab.appendChild(left);

            if (countBadge) {
                const countEl = document.createElement('span');
                countEl.className = 'hm-tab-count';
                countEl.textContent = '0/0';
                tab.appendChild(countEl);
                categoryBadges.set(id, countEl);
            }

            tab.addEventListener('click', () => {
                if (modSearchInput.value) {
                    modSearchInput.value = '';
                }
                switchTab(id);
                if (typeof onClick === 'function') onClick();
            });
            sidebar.appendChild(tab);
            return tab;
        }

        // 1. Player Lookup Tab (cat-lookup)
        createSidebarTab({
            id: 'cat-lookup',
            title: t('Player Lookup'),
            iconHtml: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            isActive: false
        });

        const lookupContent = document.createElement('div');
        lookupContent.id = 'cat-lookup';
        lookupContent.className = 'pm-tab-content';
        lookupContent.innerHTML = `
            <div class="pm-section-title">${t("Player Lookup")}</div>
            <div class="hm-cat-subtitle">${t("Instantly look up match history for any player on any game mode using their Riot ID (Name#Tag).")}</div>
        `;

        const searchRow = document.createElement('div');
        searchRow.className = 'pm-search';

        const regionSelect = document.createElement('select');
        Object.assign(regionSelect.style, {
            background: '#050e17',
            color: '#f0e6d2',
            border: '1px solid #463714',
            padding: '8px 12px',
            borderRadius: '2px',
            outline: 'none',
            fontSize: '13px',
            cursor: 'pointer'
        });
        [
            { label: t('Local Region'), value: '' },
            { label: t('Americas (NA/BR/LAN/LAS)'), value: 'NA1' },
            { label: t('Europe (EUW/EUNE/TR/RU)'), value: 'EUW' },
            { label: t('Asia (KR/JP)'), value: 'KR' },
            { label: t('SEA / OCE'), value: 'SG2' }
        ].forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.value;
            opt.textContent = r.label;
            regionSelect.appendChild(opt);
        });

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'pm-input';
        searchInput.placeholder = t('e.g. Faker#KR1');

        const searchBtn = document.createElement('button');
        searchBtn.className = 'pm-btn';
        searchBtn.textContent = t('Search');

        const meBtn = document.createElement('button');
        meBtn.className = 'pm-btn';
        meBtn.textContent = t('Me');
        meBtn.title = t('Look up your own match history');

        const resultDiv = document.createElement('div');
        resultDiv.style.marginTop = '16px';
        resultDiv.style.fontSize = '14px';

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });

        meBtn.addEventListener('click', async () => {
            resultDiv.innerHTML = '<div style="color:#c8aa6e">' + t('Looking up your account...') + '</div>';
            try {
                const me = await Utils.LCU.get('/lol-summoner/v1/current-summoner').catch(() => null);
                if (!me || !me.puuid) {
                    resultDiv.innerHTML = '<div style="color:#d92323">' + t('Could not find your account? RIOT!') + '</div>';
                    return;
                }
                const gameName = me.gameName || me.displayName || '';
                const tagLine = me.tagLine || '';
                const full = await Utils.LCU.get('/lol-summoner/v2/summoners/puuid/' + me.puuid).catch(() => null);
                const finalPlayer = { ...me, ...(full || {}), gameName, tagLine };

                resultDiv.innerHTML = '<div style="color:#0ac8b9">' + t('Loading Match History...') + '</div>';
                import('../../modules/gameAnalysisPopup.js').then(mod => {
                    mod.MatchHistoryModal.show(finalPlayer, '');
                });
                setTimeout(() => { resultDiv.innerHTML = ''; }, 1000);
            } catch (_) {
                resultDiv.innerHTML = '<div style="color:#d92323">' + t('Error looking up your account') + '</div>';
            }
        });

        searchBtn.addEventListener('click', async () => {
            const input = searchInput.value.trim();
            const selectedRegion = regionSelect.value || null;
            if (!input) {
                resultDiv.innerHTML = '<div style="color:#d92323">' + t('Please enter a name') + '</div>';
                return;
            }
            resultDiv.innerHTML = '<div style="color:#c8aa6e">' + t('Searching...') + '</div>';
            try {
                let puuidToUse = null;
                let finalPlayer = null;
                if (input.includes('#')) {
                    const parts = input.split('#');
                    if (parts.length === 2 && parts[0] && parts[1]) {
                        const [gameName, tagLine] = parts;
                        const alias = await Utils.LCU.get('/lol-summoner/v1/alias/lookup?gameName=' + encodeURIComponent(gameName) + '&tagLine=' + encodeURIComponent(tagLine)).catch(() => null);
                        if (alias && alias.puuid) {
                            puuidToUse = alias.puuid;
                            finalPlayer = { ...alias, gameName, tagLine };
                        }
                    }
                } else {
                    const sumObj = await Utils.LCU.get('/lol-summoner/v1/summoners?name=' + encodeURIComponent(input)).catch(() => null);
                    if (sumObj && sumObj.puuid) {
                        puuidToUse = sumObj.puuid;
                        finalPlayer = sumObj;
                    }
                }

                if (puuidToUse && finalPlayer) {
                    try {
                        const full = await Utils.LCU.get('/lol-summoner/v2/summoners/puuid/' + puuidToUse).catch(() => null);
                        if (full) finalPlayer = { ...finalPlayer, ...full };
                    } catch (_) {}
                    resultDiv.innerHTML = '<div style="color:#0ac8b9">' + t('Loading Match History...') + '</div>';
                    import('../../modules/gameAnalysisPopup.js').then(mod => {
                        mod.MatchHistoryModal.show(finalPlayer, '', selectedRegion);
                    });
                    setTimeout(() => {
                        resultDiv.innerHTML = '';
                        searchInput.value = '';
                    }, 1000);
                } else {
                    resultDiv.innerHTML = '<div style="color:#d92323">' + t('Player not found') + '</div>';
                }
            } catch (_) {
                resultDiv.innerHTML = '<div style="color:#d92323">' + t('Error looking up player') + '</div>';
            }
        });

        searchRow.appendChild(regionSelect);
        searchRow.appendChild(searchInput);
        searchRow.appendChild(searchBtn);
        searchRow.appendChild(meBtn);
        lookupContent.appendChild(searchRow);
        lookupContent.appendChild(resultDiv);
        content.appendChild(lookupContent);

        // Helper to build a single Hextech Module Card
        function buildModuleCard(mod) {
            const card = document.createElement('div');
            card.className = 'hm-mod-card' + (isModuleEnabled(mod) ? ' is-enabled' : '');
            card.setAttribute('data-mod-id', mod.id);

            const cardHeader = document.createElement('div');
            cardHeader.className = 'hm-mod-card-header';

            const info = document.createElement('div');
            info.className = 'hm-mod-info';

            const titleEl = document.createElement('div');
            titleEl.className = 'hm-mod-title';
            titleEl.textContent = mod.name;

            const descEl = document.createElement('div');
            descEl.className = 'hm-mod-desc';
            descEl.textContent = mod.description || '';

            info.appendChild(titleEl);
            if (mod.description) info.appendChild(descEl);
            cardHeader.appendChild(info);

            const settings = mod.settings || [];
            const primaryToggle = settings.find(s => s.type === 'toggle');
            const extraSettings = settings.filter(s => s !== primaryToggle);

            if (primaryToggle) {
                const sw = document.createElement('button');
                sw.type = 'button';
                sw.className = 'hm-hex-switch ' + (primaryToggle.value ? 'on' : 'off');

                const togglePrimary = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    const nextVal = !primaryToggle.value;
                    primaryToggle.value = nextVal;
                    if (primaryToggle.onChange) primaryToggle.onChange(nextVal);
                    sw.className = 'hm-hex-switch ' + (nextVal ? 'on' : 'off');
                    card.classList.toggle('is-enabled', isModuleEnabled(mod));
                    updateCounters();
                };

                sw.addEventListener('click', togglePrimary);
                cardHeader.addEventListener('click', togglePrimary);
                cardHeader.appendChild(sw);
            }

            card.appendChild(cardHeader);

            if (extraSettings.length > 0) {
                const cardBody = document.createElement('div');
                cardBody.className = 'hm-mod-body';

                extraSettings.forEach(setting => {
                    if (setting.type === 'toggle') {
                        const row = document.createElement('div');
                        row.className = 'pm-row';
                        row.style.cursor = 'pointer';

                        const lblWrapper = document.createElement('div');
                        lblWrapper.className = 'pm-label-wrapper';
                        const lblTitle = document.createElement('div');
                        lblTitle.className = 'pm-label-title';
                        lblTitle.textContent = setting.label || mod.name;
                        lblWrapper.appendChild(lblTitle);

                        const sw = document.createElement('button');
                        sw.type = 'button';
                        sw.className = 'hm-hex-switch ' + (setting.value ? 'on' : 'off');

                        const toggleSub = (e) => {
                            if (e) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                            const nextVal = !setting.value;
                            setting.value = nextVal;
                            if (setting.onChange) setting.onChange(nextVal);
                            sw.className = 'hm-hex-switch ' + (nextVal ? 'on' : 'off');
                            card.classList.toggle('is-enabled', isModuleEnabled(mod));
                            updateCounters();
                        };

                        sw.addEventListener('click', toggleSub);
                        row.addEventListener('click', toggleSub);
                        row.appendChild(lblWrapper);
                        row.appendChild(sw);
                        cardBody.appendChild(row);
                    } else if (setting.type === 'select') {
                        const row = document.createElement('div');
                        row.className = 'pm-row';

                        const select = document.createElement('select');
                        Object.assign(select.style, {
                            background: '#050e17',
                            color: '#f0e6d2',
                            border: '1px solid #463714',
                            padding: '7px 10px',
                            borderRadius: '2px',
                            flex: '1',
                            outline: 'none',
                            fontSize: '13px'
                        });

                        setting.options.forEach(opt => {
                            const el = document.createElement('option');
                            el.value = opt.value;
                            el.textContent = opt.label;
                            select.appendChild(el);
                        });

                        select.value = setting.value;
                        select.addEventListener('change', (e) => {
                            if (setting.onChange) setting.onChange(e.target.value);
                        });

                        row.appendChild(select);
                        cardBody.appendChild(row);
                    } else if (setting.type === 'textarea') {
                        const row = document.createElement('div');
                        row.className = 'pm-row';

                        const input = document.createElement('textarea');
                        input.placeholder = setting.placeholder || '';
                        Object.assign(input.style, {
                            background: '#050e17',
                            color: '#f0e6d2',
                            border: '1px solid #463714',
                            padding: '8px 12px',
                            borderRadius: '2px',
                            outline: 'none',
                            boxSizing: 'border-box',
                            width: '100%',
                            minHeight: '68px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: '13px'
                        });

                        input.value = setting.value || '';
                        input.addEventListener('change', (e) => {
                            if (setting.onChange) setting.onChange(e.target.value);
                        });
                        input.addEventListener('click', (ev) => ev.stopPropagation());

                        row.appendChild(input);
                        cardBody.appendChild(row);
                    } else if (setting.type === 'custom') {
                        const row = document.createElement('div');
                        row.className = 'pm-row';
                        row.style.background = 'transparent';
                        row.style.border = 'none';
                        row.style.padding = '2px 0';

                        if (setting.render) {
                            setting.render(row);
                        }
                        cardBody.appendChild(row);
                    }
                });

                card.appendChild(cardBody);
            }

            return card;
        }

        // 2. Build the 4 Feature Category Tabs
        const assignedModIds = new Set();
        CATEGORY_DEFINITIONS.forEach((cat, idx) => {
            createSidebarTab({
                id: cat.id,
                title: t(cat.titleKey),
                iconHtml: cat.icon,
                countBadge: true,
                isActive: idx === 0
            });

            const catPane = document.createElement('div');
            catPane.id = cat.id;
            catPane.className = 'pm-tab-content' + (idx === 0 ? ' active' : '');

            const title = document.createElement('div');
            title.className = 'pm-section-title';
            title.textContent = t(cat.titleKey);

            const sub = document.createElement('div');
            sub.className = 'hm-cat-subtitle';
            sub.textContent = t(cat.subtitleKey);

            const grid = document.createElement('div');
            grid.className = 'hm-mod-grid';

            const hiddenIds = getHiddenModuleIds();
            cat.moduleIds.forEach(modId => {
                assignedModIds.add(modId);
                const mod = registeredModules.find(m => m.id === modId);
                if (!mod || !mod.settings || mod.settings.length === 0) return;
                const card = buildModuleCard(mod);
                if (hiddenIds.has(mod.id)) card.style.display = 'none';
                grid.appendChild(card);
            });

            // Include any additional registered modules not yet assigned to a category in the last category
            if (idx === CATEGORY_DEFINITIONS.length - 1) {
                registeredModules.forEach(mod => {
                    if (assignedModIds.has(mod.id) || !mod.settings || mod.settings.length === 0) return;
                    const card = buildModuleCard(mod);
                    if (hiddenIds.has(mod.id)) card.style.display = 'none';
                    grid.appendChild(card);
                });
            }

            catPane.appendChild(title);
            catPane.appendChild(sub);
            catPane.appendChild(grid);
            content.appendChild(catPane);
        });

        // Search Results Pane
        const searchPane = document.createElement('div');
        searchPane.id = 'cat-search-results';
        searchPane.className = 'pm-tab-content';
        const searchTitle = document.createElement('div');
        searchTitle.className = 'pm-section-title';
        searchTitle.textContent = t('Search Results');
        const searchSub = document.createElement('div');
        searchSub.className = 'hm-cat-subtitle';
        const searchGrid = document.createElement('div');
        searchGrid.className = 'hm-mod-grid';
        searchPane.appendChild(searchTitle);
        searchPane.appendChild(searchSub);
        searchPane.appendChild(searchGrid);
        content.appendChild(searchPane);

        modSearchInput.addEventListener('input', () => {
            const q = modSearchInput.value.trim().toLowerCase();
            if (!q) {
                switchTab(activeTabId === 'cat-search-results' ? 'cat-lobby' : activeTabId);
                return;
            }
            content.querySelectorAll('.pm-tab-content').forEach(el => el.classList.remove('active'));
            searchPane.classList.add('active');
            searchGrid.innerHTML = '';

            const hiddenIds = getHiddenModuleIds();
            const matches = registeredModules.filter(m => {
                if (!m.settings || m.settings.length === 0 || hiddenIds.has(m.id)) return false;
                const text = `${m.name || ''} ${m.description || ''} ${(m.settings || []).map(s => s.label || '').join(' ')}`.toLowerCase();
                return text.includes(q);
            });

            searchSub.textContent = `${matches.length} ${t('modules matched')} "${modSearchInput.value.trim()}"`;
            matches.forEach(m => searchGrid.appendChild(buildModuleCard(m)));
        });

        // 3. System Settings Tab (cat-settings)
        const settingsTabId = 'cat-settings';
        const settingsTabContent = document.createElement('div');
        settingsTabContent.id = settingsTabId;
        settingsTabContent.className = 'pm-tab-content';
        content.appendChild(settingsTabContent);

        createSidebarTab({
            id: settingsTabId,
            title: t('System Settings'),
            iconHtml: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            extraClass: 'pm-tab-settings',
            onClick: () => buildSettingsContent(settingsTabContent)
        });

        function buildSettingsContent(container) {
            container.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

            function makeSettingsSection(title, desc) {
                const section = document.createElement('div');
                section.className = 'pm-settings-section';
                const h = document.createElement('div');
                h.className = 'pm-settings-section-title';
                h.textContent = title;
                section.appendChild(h);
                if (desc) {
                    const d = document.createElement('div');
                    d.className = 'pm-settings-section-desc';
                    d.textContent = desc;
                    section.appendChild(d);
                }
                return section;
            }

            function makeSettingsToggle(initialValue, onChange) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'hm-hex-switch ' + (initialValue ? 'on' : 'off');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const next = !btn.classList.contains('on');
                    btn.className = 'hm-hex-switch ' + (next ? 'on' : 'off');
                    onChange(next);
                });
                return btn;
            }

            // General Section
            const generalSection = makeSettingsSection(t('General'), t('Global plugin manager settings.'));

            const languageRow = document.createElement('div');
            languageRow.className = 'pm-settings-row';
            const languageLabel = document.createElement('span');
            languageLabel.className = 'pm-settings-row-label';
            languageLabel.textContent = t('Language (Requires reload)');

            const languageSelect = document.createElement('select');
            Object.assign(languageSelect.style, {
                background: '#050e17', color: '#f0e6d2', border: '1px solid #463714',
                padding: '6px 12px', borderRadius: '2px', outline: 'none',
                fontSize: '13px', cursor: 'pointer'
            });

            for (const [val, label] of Object.entries(SUPPORTED_LANGUAGES)) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (val === getCurrentLanguage()) opt.selected = true;
                languageSelect.appendChild(opt);
            }

            languageSelect.addEventListener('change', (e) => setLanguage(e.target.value));
            languageRow.appendChild(languageLabel);
            languageRow.appendChild(languageSelect);
            generalSection.appendChild(languageRow);

            const hotkeyRow = document.createElement('div');
            hotkeyRow.className = 'pm-settings-row';
            const hotkeyLabel = document.createElement('span');
            hotkeyLabel.className = 'pm-settings-row-label';
            hotkeyLabel.textContent = t('Menu Shortcut (Click to set)');

            const hotkeyBtn = document.createElement('button');
            hotkeyBtn.className = 'pm-btn';
            hotkeyBtn.style.minWidth = '140px';

            let currentHotkey = getMenuHotkey();
            hotkeyBtn.textContent = currentHotkey.display;

            hotkeyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window._isCapturingHotkey) return;
                window._isCapturingHotkey = true;
                hotkeyBtn.textContent = t('Press keys...');
                hotkeyBtn.style.borderColor = '#0ac8b9';
                hotkeyBtn.style.color = '#0ac8b9';

                const cleanup = () => {
                    window._isCapturingHotkey = false;
                    document.removeEventListener('keydown', onKeyDown, { capture: true });
                    document.removeEventListener('keyup', onKeyUp, { capture: true });
                    document.removeEventListener('mousedown', onMouseDown, { capture: true });
                    hotkeyBtn.style.borderColor = '';
                    hotkeyBtn.style.color = '';
                };

                const onKeyDown = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key);
                    const parts = [];
                    if (ev.ctrlKey) parts.push('Ctrl');
                    if (ev.shiftKey) parts.push('Shift');
                    if (ev.altKey) parts.push('Alt');
                    if (ev.metaKey) parts.push('Win/Cmd');

                    if (!isModifier) {
                        if (ev.code === 'Escape' && parts.length === 0) {
                            hotkeyBtn.textContent = currentHotkey.display;
                            cleanup();
                            return;
                        }
                        let keyName = ev.code;
                        if (keyName.startsWith('Key')) keyName = keyName.slice(3);
                        else if (keyName.startsWith('Digit')) keyName = keyName.slice(5);
                        else if (keyName === 'Space') keyName = 'Space';
                        parts.push(keyName);

                        if (parts.length > 3) {
                            hotkeyBtn.textContent = t('Max 3 keys!');
                            setTimeout(() => {
                                if (!window._isCapturingHotkey) return;
                                hotkeyBtn.textContent = currentHotkey.display;
                            }, 1000);
                            cleanup();
                            return;
                        }

                        currentHotkey = {
                            ctrlKey: ev.ctrlKey,
                            shiftKey: ev.shiftKey,
                            altKey: ev.altKey,
                            metaKey: ev.metaKey,
                            code: ev.code,
                            display: parts.join(' + ')
                        };
                        Utils.Store.set('core', 'hotkeyObj', currentHotkey);
                        hotkeyBtn.textContent = currentHotkey.display;
                        hotkeyPill.textContent = currentHotkey.display;
                        cleanup();
                    } else {
                        hotkeyBtn.textContent = parts.join(' + ') + ' + ...';
                    }
                };

                const onKeyUp = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key);
                    if (isModifier && window._isCapturingHotkey) {
                        if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                            hotkeyBtn.textContent = t('Press keys...');
                        } else {
                            const parts = [];
                            if (ev.ctrlKey) parts.push('Ctrl');
                            if (ev.shiftKey) parts.push('Shift');
                            if (ev.altKey) parts.push('Alt');
                            if (ev.metaKey) parts.push('Win/Cmd');
                            if (parts.length > 0) hotkeyBtn.textContent = parts.join(' + ') + ' + ...';
                        }
                    }
                };

                const onMouseDown = (ev) => {
                    if (!hotkeyBtn.contains(ev.target)) {
                        hotkeyBtn.textContent = currentHotkey.display;
                        cleanup();
                    }
                };

                document.addEventListener('keydown', onKeyDown, { capture: true });
                document.addEventListener('keyup', onKeyUp, { capture: true });
                document.addEventListener('mousedown', onMouseDown, { capture: true });
            });

            hotkeyRow.appendChild(hotkeyLabel);
            hotkeyRow.appendChild(hotkeyBtn);
            generalSection.appendChild(hotkeyRow);
            wrap.appendChild(generalSection);

            // Updates Section
            const updateSection = makeSettingsSection(
                t('Updates'),
                t('Check GitHub for new Hex-Manager releases.')
            );

            const autoCheckEnabled = Utils.Store.get('core', 'checkUpdates') !== false;
            const autoCheckRow = document.createElement('div');
            autoCheckRow.className = 'pm-settings-row';
            const autoCheckLabel = document.createElement('span');
            autoCheckLabel.className = 'pm-settings-row-label';
            autoCheckLabel.textContent = t('Auto-check for updates on startup');
            const autoCheckToggle = makeSettingsToggle(autoCheckEnabled, (val) => {
                Utils.Store.set('core', 'checkUpdates', val);
            });
            autoCheckRow.appendChild(autoCheckLabel);
            autoCheckRow.appendChild(autoCheckToggle);
            updateSection.appendChild(autoCheckRow);

            const updateStatusEl = document.createElement('div');
            updateStatusEl.className = 'pm-update-status' + (getLatestRelease() ? ' has-update' : '');

            function renderUpdateStatus() {
                const rel = getLatestRelease();
                updateStatusEl.innerHTML = '';
                updateStatusEl.className = 'pm-update-status' + (rel ? ' has-update' : '');
                if (rel) {
                    const title = document.createElement('div');
                    title.className = 'pm-update-title';
                    title.textContent = t("Update available: v{{version}}", { version: rel.version });
                    updateStatusEl.appendChild(title);

                    const relName = document.createElement('div');
                    relName.className = 'pm-update-rel-name';
                    relName.textContent = rel.name;
                    updateStatusEl.appendChild(relName);

                    if (rel.body) {
                        const notes = document.createElement('div');
                        notes.className = 'pm-update-notes';
                        notes.textContent = rel.body;
                        updateStatusEl.appendChild(notes);
                    }

                    const linkRow = document.createElement('div');
                    linkRow.style.cssText = 'display:flex;gap:8px;align-items:center;';
                    const link = document.createElement('a');
                    link.href = rel.url;
                    link.target = '_blank';
                    link.className = 'pm-update-link';
                    link.textContent = t('View release on GitHub');
                    linkRow.appendChild(link);
                    updateStatusEl.appendChild(linkRow);
                } else {
                    const span = document.createElement('span');
                    span.style.color = '#7e7968';
                    span.textContent = t("Current version: v{{version}} - up to date", { version: getCurrentVersion() });
                    updateStatusEl.appendChild(span);
                }
            }

            renderUpdateStatus();
            updateSection.appendChild(updateStatusEl);
            setUpdateBadgeCallback(renderUpdateStatus);

            const checkBtnRow = document.createElement('div');
            checkBtnRow.className = 'pm-update-check-row';
            const checkBtn = document.createElement('button');
            checkBtn.className = 'pm-btn';
            checkBtn.textContent = t('Check now');
            const checkStatus = document.createElement('span');
            checkStatus.className = 'pm-update-check-status';

            checkBtn.addEventListener('click', async () => {
                checkBtn.disabled = true;
                checkBtn.textContent = t('Checking...');
                checkStatus.textContent = '';
                await checkForUpdates(true);
                renderUpdateStatus();
                checkBtn.disabled = false;
                checkBtn.textContent = t('Check now');
                checkStatus.textContent = getLatestRelease() ? '' : t('Already up to date');
                setTimeout(() => { checkStatus.textContent = ''; }, 3000);
            });

            checkBtnRow.appendChild(checkBtn);
            checkBtnRow.appendChild(checkStatus);
            updateSection.appendChild(checkBtnRow);
            wrap.appendChild(updateSection);

            // About Section
            const aboutSection = makeSettingsSection(t('About'), '');
            const aboutContent = document.createElement('div');
            aboutContent.style.cssText = 'font-size:12px;color:#8c8778;line-height:1.8;margin-top:6px;';
            [
                { label: t('Plugin:'), value: t('Hex-Manager by Triggered0') },
                { label: t('Version:'), value: `v${getCurrentVersion()}` },
                { label: t('GitHub:'), value: 'github.com/Triggered0/Hex-Manager', href: 'https://github.com/Triggered0/Hex-Manager' }
            ].forEach(({ label, value, href }) => {
                const row = document.createElement('div');
                const labelEl = document.createElement('span');
                labelEl.style.color = '#785a28';
                labelEl.textContent = label + ' ';
                const valueEl = href ? document.createElement('a') : document.createElement('span');
                if (href) {
                    valueEl.href = href;
                    valueEl.target = '_blank';
                    valueEl.style.cssText = 'color:#c8aa6e;text-decoration:underline;cursor:pointer;';
                } else {
                    valueEl.style.color = '#cdbe91';
                }
                valueEl.textContent = value;
                row.appendChild(labelEl);
                row.appendChild(valueEl);
                aboutContent.appendChild(row);
            });
            aboutSection.appendChild(aboutContent);
            wrap.appendChild(aboutSection);

            // Developer Section
            const devSection = makeSettingsSection(t('Developer'), t('Developer / debug settings. Enable to see debug logs from modules.'));
            const debugEnabled = Utils.Store.get('core', 'debugLogs') === true;
            const debugRow = document.createElement('div');
            debugRow.className = 'pm-settings-row';
            const debugLabel = document.createElement('span');
            debugLabel.className = 'pm-settings-row-label';
            debugLabel.textContent = t('Enable debug logs');
            const debugToggle = makeSettingsToggle(debugEnabled, (val) => {
                Utils.Store.set('core', 'debugLogs', val);
                Utils.Debug.setEnabled(val);
            });
            debugRow.appendChild(debugLabel);
            debugRow.appendChild(debugToggle);
            devSection.appendChild(debugRow);
            wrap.appendChild(devSection);

            container.appendChild(wrap);
        }

        updateCounters();

        _root.appendChild(overlay);
        _root.appendChild(modal);

        const viewportOverlay = document.querySelector('.rcp-fe-viewport-overlay');
        if (viewportOverlay && viewportOverlay.parentNode === document.body) viewportOverlay.after(_root);
        else document.body.appendChild(_root);
    }

    function show() {
        if (!_root || !document.body.contains(_root)) create();
        _root.classList.add('pm-show');
        _visible = true;
        _cbs.forEach(f => f(true));
    }

    function hide() {
        if (_root) _root.classList.remove('pm-show');
        _visible = false;
        _cbs.forEach(f => f(false));
    }

    function toggle() {
        if (_visible) hide();
        else show();
    }

    function onChange(f) {
        _cbs.add(f);
        return () => _cbs.delete(f);
    }

    function init() {
        create();
        if (_keydownHandler) return;
        _keydownHandler = (e) => {
            if (window._isCapturingHotkey) return;
            const shortcut = getMenuHotkey();
            if (!e.repeat &&
                e.ctrlKey === shortcut.ctrlKey &&
                e.shiftKey === shortcut.shiftKey &&
                e.altKey === shortcut.altKey &&
                e.metaKey === shortcut.metaKey &&
                e.code === shortcut.code) {
                const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
                if (isInput) {
                    const isSafeKey = /^F\d+$/.test(shortcut.code) || shortcut.code === 'Escape' || shortcut.code.startsWith('Arrow');
                    const hasModifier = shortcut.ctrlKey || shortcut.altKey || shortcut.metaKey;
                    if (!isSafeKey && !hasModifier) return;
                }
                e.preventDefault();
                toggle();
            }
        };
        document.addEventListener('keydown', _keydownHandler);
    }

    function destroy() {
        if (_keydownHandler) document.removeEventListener('keydown', _keydownHandler);
        _keydownHandler = null;
        _root?.remove();
        document.getElementById('pm-styles')?.remove();
        _root = null;
        _visible = false;
        _cbs.clear();
    }

    return { init, show, hide, toggle, onChange, destroy };
})();
