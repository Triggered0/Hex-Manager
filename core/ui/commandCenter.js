import Utils from '../utils.js';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, t } from '../i18n.js';
import { checkForUpdates, getCurrentVersion, getLatestRelease, setUpdateBadgeCallback } from '../updater.js';
import { registeredModules, getDisabledModuleIds, getModuleInfo, getMenuHotkey } from '../registry.js';
import { STYLE_CONTENT } from './theme.js';

export const Modal = (function() {
    let _root = null;
    let _visible = false;
    let _keydownHandler = null;
    const _cbs = new Set();

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

        const header = document.createElement('div');
        header.className = 'pm-header';
        header.innerHTML = '<h2 class="pm-title">' + t("HEX MANAGER") + '</h2>';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'pm-close';
        closeBtn.innerHTML = t('✕');
        closeBtn.addEventListener('click', () => hide());
        header.appendChild(closeBtn);
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

        let activeTabId = 'tab-lookup';

        function switchTab(tabId) {
            activeTabId = tabId;
            sidebar.querySelectorAll('.pm-tab').forEach(t => t.classList.remove('active'));
            content.querySelectorAll('.pm-tab-content').forEach(c => c.classList.remove('active'));

            const tab = sidebar.querySelector(`[data-target="${tabId}"]`);
            const tabContent = content.querySelector(`#${tabId}`);
            if (tab) tab.classList.add('active');
            if (tabContent) tabContent.classList.add('active');
        }

        function createTab(id, title, isActive = false) {
            const tab = document.createElement('div');
            tab.className = 'pm-tab' + (isActive ? ' active' : '');
            tab.setAttribute('data-target', id);
            tab.textContent = title;
            tab.addEventListener('click', () => switchTab(id));
            sidebar.appendChild(tab);
        }

        // Search Section (Player Lookup)
        createTab('tab-lookup', t('Player Lookup'), true);

        const lookupContent = document.createElement('div');
        lookupContent.id = 'tab-lookup';
        lookupContent.className = 'pm-tab-content active';
        lookupContent.innerHTML = `
      <div class="pm-section-title">${t("Player Lookup")}</div>
      <div style="color:#a09b8c; font-size:13px; margin-bottom:20px; line-height:1.5;">${t("Instantly look up match history for any player on any game mode using their Riot ID (Name#Tag).")}</div>
    `;

        const searchRow = document.createElement('div');
        searchRow.className = 'pm-search';

        const regionSelect = document.createElement('select');
        Object.assign(regionSelect.style, {
            background: '#111',
            color: '#f0e6d2',
            border: '1px solid #3e2e13',
            padding: '8px 12px',
            borderRadius: '2px',
            outline: 'none',
            fontSize: '13px',
            cursor: 'pointer'
        });
        const regions = [{
                label: t('Local Region'),
                value: ''
            },
            {
                label: t('Americas (NA/BR/LAN/LAS)'),
                value: 'NA1'
            },
            {
                label: t('Europe (EUW/EUNE/TR/RU)'),
                value: 'EUW'
            },
            {
                label: t('Asia (KR/JP)'),
                value: 'KR'
            },
            {
                label: t('SEA / OCE'),
                value: 'SG2'
            }
        ];
        regions.forEach(r => {
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
                const finalPlayer = {
                    ...me,
                    ...(full || {}),
                    gameName,
                    tagLine
                };

                resultDiv.innerHTML = '<div style="color:#0ac8b9">' + t('Loading Match History...') + '</div>';
                import('../../modules/gameAnalysisPopup.js').then(mod => {
                    mod.MatchHistoryModal.show(finalPlayer, '');
                });
                setTimeout(() => {
                    resultDiv.innerHTML = '';
                }, 1000);
            } catch (e) {
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

                // lookup handling
                if (input.includes('#')) {
                    const parts = input.split('#');
                    if (parts.length === 2 && parts[0] && parts[1]) {
                        const gameName = parts[0];
                        const tagLine = parts[1];
                        const alias = await Utils.LCU.get('/lol-summoner/v1/alias/lookup?gameName=' + encodeURIComponent(gameName) + '&tagLine=' + encodeURIComponent(tagLine)).catch(() => null);

                        if (alias && alias.puuid) {
                            puuidToUse = alias.puuid;
                            finalPlayer = {
                                ...alias,
                                gameName,
                                tagLine
                            };
                        }
                    }
                } else {
                    // Try looking up by old summoner name
                    const sumObj = await Utils.LCU.get('/lol-summoner/v1/summoners?name=' + encodeURIComponent(input)).catch(() => null);
                    if (sumObj && sumObj.puuid) {
                        puuidToUse = sumObj.puuid;
                        finalPlayer = sumObj;
                    }
                }

                if (puuidToUse && finalPlayer) {
                    try {
                        const full = await Utils.LCU.get('/lol-summoner/v2/summoners/puuid/' + puuidToUse).catch(() => null);
                        if (full) finalPlayer = {
                            ...finalPlayer,
                            ...full
                        };
                    } catch (e) {}

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
            } catch (e) {
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

        // Modules Sections
        registeredModules.sort((a, b) => a.name.localeCompare(b.name));

        function getHiddenModuleIds() {
            const v = Utils.Store.get('core', 'hiddenModules');
            return Array.isArray(v) ? new Set(v) : new Set();
        }

        function isModuleEnabled(mod) {
            return (mod.settings || []).some(s => s.type === 'toggle' && s.value === true);
        }

        registeredModules.forEach(mod => {
            if (!mod.settings || mod.settings.length === 0) return;

            const hiddenIds = getHiddenModuleIds();
            const isHidden = hiddenIds.has(mod.id);

            const tabId = 'tab-' + mod.id;
            createTab(tabId, mod.name);

            const tabEl = sidebar.querySelector(`[data-target="${tabId}"]`);
            if (tabEl && isHidden) tabEl.style.display = 'none';

            const tabContent = document.createElement('div');
            tabContent.id = tabId;
            tabContent.className = 'pm-tab-content';

            const modTitle = document.createElement('div');
            modTitle.className = 'pm-section-title';
            modTitle.textContent = mod.name;

            const modDesc = document.createElement('div');
            Object.assign(modDesc.style, {
                color: '#a09b8c',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: '1.5'
            });
            modDesc.textContent = mod.description;

            tabContent.appendChild(modTitle);
            tabContent.appendChild(modDesc);

            mod.settings.forEach(setting => {
                if (setting.type === 'toggle') {
                    const row = document.createElement('div');
                    row.className = 'pm-row';

                    const lblWrapper = document.createElement('div');
                    lblWrapper.className = 'pm-label-wrapper';
                    const lblTitle = document.createElement('div');
                    lblTitle.className = 'pm-label-title';
                    lblTitle.textContent = setting.label || mod.name;
                    lblWrapper.appendChild(lblTitle);

                    const sw = document.createElement('button');
                    sw.type = 'button';
                    sw.className = 'pm-toggle-btn ' + (setting.value ? 'on' : 'off');

                    const toggleFn = (e) => {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        const v = !setting.value;
                        setting.value = v;
                        if (setting.onChange) setting.onChange(v);
                        sw.className = 'pm-toggle-btn ' + (v ? 'on' : 'off');
                    };
                    sw.onclick = toggleFn;
                    row.onclick = toggleFn;
                    row.style.cursor = 'pointer';

                    row.appendChild(lblWrapper);
                    row.appendChild(sw);
                    tabContent.appendChild(row);
                } else if (setting.type === 'select') {
                    const row = document.createElement('div');
                    row.className = 'pm-row';
                    row.style.background = 'transparent';
                    row.style.padding = '0 16px 16px';
                    row.style.border = 'none';
                    row.style.marginBottom = '0';

                    const select = document.createElement('select');
                    Object.assign(select.style, {
                        background: '#111',
                        color: '#f0e6d2',
                        border: '1px solid #3e2e13',
                        padding: '8px',
                        borderRadius: '4px',
                        flex: '1',
                        outline: 'none',
                        fontSize: '14px'
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
                    tabContent.appendChild(row);
                } else if (setting.type === 'textarea') {
                    const row = document.createElement('div');
                    row.className = 'pm-row';
                    row.style.background = 'transparent';
                    row.style.padding = '0 16px 16px';
                    row.style.border = 'none';
                    row.style.marginBottom = '0';

                    const input = document.createElement('textarea');
                    input.placeholder = setting.placeholder || '';
                    Object.assign(input.style, {
                        background: '#111',
                        color: '#f0e6d2',
                        border: '1px solid #3e2e13',
                        padding: '10px 14px',
                        borderRadius: '4px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        width: '100%',
                        minHeight: '80px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        fontSize: '14px'
                    });

                    input.value = setting.value || '';
                    input.addEventListener('change', (e) => {
                        if (setting.onChange) setting.onChange(e.target.value);
                    });
                    input.addEventListener('click', (ev) => ev.stopPropagation());

                    row.appendChild(input);
                    tabContent.appendChild(row);
                } else if (setting.type === 'custom') {
                    const row = document.createElement('div');
                    row.className = 'pm-row';
                    row.style.background = 'transparent';
                    row.style.padding = '0 16px 16px';
                    row.style.border = 'none';
                    row.style.marginBottom = '0';

                    if (setting.render) {
                        setting.render(row);
                    }

                    tabContent.appendChild(row);
                }
            });
            content.appendChild(tabContent);
        });

        // Settings Tab
        const settingsTabId = 'tab-settings';

        const settingsTab = document.createElement('div');
        settingsTab.className = 'pm-tab pm-tab-settings';
        settingsTab.setAttribute('data-target', settingsTabId);
        settingsTab.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>${t('Settings')}`;
        settingsTab.addEventListener('click', () => {
            switchTab(settingsTabId);
            buildSettingsContent(settingsTabContent);
        });
        sidebar.appendChild(settingsTab);

        const settingsTabContent = document.createElement('div');
        settingsTabContent.id = settingsTabId;
        settingsTabContent.className = 'pm-tab-content';
        content.appendChild(settingsTabContent);

        function buildSettingsContent(container) {
            container.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

            // Section helper
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

            // Pill toggle helper
            function makeSettingsToggle(initialValue, onChange) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pm-toggle-btn ' + (initialValue ? 'on' : 'off');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const next = !btn.classList.contains('on');
                    btn.className = 'pm-toggle-btn ' + (next ? 'on' : 'off');
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
                background: '#111', color: '#f0e6d2', border: '1px solid #3e2e13',
                padding: '6px 12px', borderRadius: '4px', outline: 'none',
                fontSize: '13px', cursor: 'pointer'
            });

            for (const [val, label] of Object.entries(SUPPORTED_LANGUAGES)) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (val === getCurrentLanguage()) opt.selected = true;
                languageSelect.appendChild(opt);
            }

            languageSelect.addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });

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
                    document.removeEventListener('keydown', onKeyDown, {
                        capture: true
                    });
                    document.removeEventListener('keyup', onKeyUp, {
                        capture: true
                    });
                    document.removeEventListener('mousedown', onMouseDown, {
                        capture: true
                    });
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
                        // Cancel capture on Escape without modifiers
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

                        const newHotkey = {
                            ctrlKey: ev.ctrlKey,
                            shiftKey: ev.shiftKey,
                            altKey: ev.altKey,
                            metaKey: ev.metaKey,
                            code: ev.code,
                            display: parts.join(' + ')
                        };

                        currentHotkey = newHotkey;
                        Utils.Store.set('core', 'hotkeyObj', currentHotkey);
                        hotkeyBtn.textContent = currentHotkey.display;
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
                            if (parts.length > 0) {
                                hotkeyBtn.textContent = parts.join(' + ') + ' + ...';
                            }
                        }
                    }
                };

                const onMouseDown = (ev) => {
                    if (!hotkeyBtn.contains(ev.target)) {
                        hotkeyBtn.textContent = currentHotkey.display;
                        cleanup();
                    }
                };

                document.addEventListener('keydown', onKeyDown, {
                    capture: true
                });
                document.addEventListener('keyup', onKeyUp, {
                    capture: true
                });
                document.addEventListener('mousedown', onMouseDown, {
                    capture: true
                });
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

            // Status area
            const updateStatusEl = document.createElement('div');
            updateStatusEl.className = 'pm-update-status' + (getLatestRelease() ? ' has-update' : '');

            function renderUpdateStatus() {
                updateStatusEl.innerHTML = '';
                updateStatusEl.className = 'pm-update-status' + (getLatestRelease() ? ' has-update' : '');
                if (getLatestRelease()) {
                    const title = document.createElement('div');
                    title.className = 'pm-update-title';
                    title.textContent = t("Update available: v{{version}}", { version: getLatestRelease().version });
                    updateStatusEl.appendChild(title);

                    const relName = document.createElement('div');
                    relName.className = 'pm-update-rel-name';
                    relName.textContent = getLatestRelease().name;
                    updateStatusEl.appendChild(relName);

                    if (getLatestRelease().body) {
                        const notes = document.createElement('div');
                        notes.className = 'pm-update-notes';
                        notes.textContent = getLatestRelease().body;
                        updateStatusEl.appendChild(notes);
                    }

                    const linkRow = document.createElement('div');
                    linkRow.style.cssText = 'display:flex;gap:8px;align-items:center;';
                    const link = document.createElement('a');
                    link.href = getLatestRelease().url;
                    link.target = '_blank';
                    link.className = 'pm-update-link';
                    link.textContent = t('View release on GitHub');
                    linkRow.appendChild(link);
                    updateStatusEl.appendChild(linkRow);
                } else {
                    const span = document.createElement('span');
                    span.style.color = '#3a5060';
                    span.textContent = t("Current version: v{{version}} - up to date", { version: getCurrentVersion() });
                    updateStatusEl.appendChild(span);
                }
            }

            renderUpdateStatus();
            updateSection.appendChild(updateStatusEl);

            // Live badge callback: update status box if tab is open when bg check finishes
            setUpdateBadgeCallback(renderUpdateStatus);

            // Check now button
            const checkBtnRow = document.createElement('div');
            checkBtnRow.className = 'pm-update-check-row';

            const checkBtn = document.createElement('button');
            checkBtn.className = 'pm-btn';
            checkBtn.style.cssText = 'font-size:12px;padding:5px 12px;';
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
                setTimeout(() => {
                    checkStatus.textContent = '';
                }, 3000);
            });

            checkBtnRow.appendChild(checkBtn);
            checkBtnRow.appendChild(checkStatus);
            updateSection.appendChild(checkBtnRow);
            wrap.appendChild(updateSection);

            // About Section 
            const aboutSection = makeSettingsSection(t('About'), '');

            const aboutContent = document.createElement('div');
            aboutContent.style.cssText = 'font-size:12px;color:#3a5060;line-height:1.8;margin-top:8px;';

            const aboutLines = [{
                    label: t('Plugin:'),
                    value: t('Hex-Manager by Triggered0')
                },
                {
                    label: t('Version:'),
                    value: `v${getCurrentVersion()}`
                },
                {
                    label: t('GitHub:'),
                    value: 'github.com/Triggered0/Hex-Manager',
                    href: 'https://github.com/Triggered0/Hex-Manager'
                },
            ];

            aboutLines.forEach(({
                label,
                value,
                href
            }) => {
                const row = document.createElement('div');
                const labelEl = document.createElement('span');
                labelEl.style.color = '#5a7080';
                labelEl.textContent = label + ' ';
                let valueEl;
                if (href) {
                    valueEl = document.createElement('a');
                    valueEl.href = href;
                    valueEl.target = '_blank';
                    valueEl.style.cssText = 'color:#785a28;text-decoration:underline;cursor:pointer;';
                } else {
                    valueEl = document.createElement('span');
                    valueEl.style.color = '#7a8a9a';
                }
                valueEl.textContent = value;
                row.appendChild(labelEl);
                row.appendChild(valueEl);
                aboutContent.appendChild(row);
            });

            aboutSection.appendChild(aboutContent);
            wrap.appendChild(aboutSection);

            // Developer Section (debug logs)
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

            // Module Visibility Section
            const visSection = makeSettingsSection(t('Module Visibility'), t('Choose which modules appear in the sidebar. Modules with an active toggle are marked with a green dot - hidden modules can also be fully disabled so their code never runs (red dot).'));

            const visDualList = document.createElement('div');
            visDualList.style.cssText = 'display:flex;gap:12px;margin-top:10px;';

            function buildVisibilityList() {
                const _prevScrollTops = [];
                visDualList.querySelectorAll('div[style*="overflow-y: auto"]').forEach(el => _prevScrollTops.push(el.scrollTop));
                visDualList.innerHTML = '';

                const hiddenIds = (() => {
                    const v = Utils.Store.get('core', 'hiddenModules');
                    return Array.isArray(v) ? new Set(v) : new Set();
                })();
                const disabledIds = getDisabledModuleIds();

                disabledIds.forEach(id => {
                    if (!registeredModules.some(m => m.id === id)) {
                        registeredModules.push({
                            id,
                            name: (getModuleInfo()[id] || {}).name || id,
                            description: '',
                            settings: [],
                            __disabledStub: true
                        });
                    }
                });

                const visibleMods = registeredModules.filter(m => (m.__disabledStub || (m.settings && m.settings.length > 0)) && !hiddenIds.has(m.id));
                const hiddenMods = registeredModules.filter(m => (m.__disabledStub || (m.settings && m.settings.length > 0)) && hiddenIds.has(m.id));

                function makeColumn(title, mods, actions) {
                    const col = document.createElement('div');
                    col.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:6px;min-width:0;';

                    const colTitle = document.createElement('div');
                    colTitle.textContent = title;
                    colTitle.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#c8aa6e;margin-bottom:4px;';
                    col.appendChild(colTitle);

                    const list = document.createElement('div');
                    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-height:80px;max-height:240px;overflow-y:auto;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:6px;';
                    list.style.scrollbarWidth = 'thin';

                    if (mods.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = t('None');
                        empty.style.cssText = 'color:#3a5060;font-size:12px;text-align:center;padding:20px 0;';
                        list.appendChild(empty);
                    }

                    mods.forEach(mod => {
                        const enabled = (mod.settings || []).some(s => s.type === 'toggle' && s.value === true);
                        const isDisabled = disabledIds.has(mod.id);
                        const item = document.createElement('div');
                        item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;border-radius:4px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.04);transition:background 0.15s;';
                        item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.05)';
                        item.onmouseout = () => item.style.background = 'rgba(255,255,255,0.015)';

                        const nameWrap = document.createElement('div');
                        nameWrap.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow:hidden;';

                        if (isDisabled) {
                            const dot = document.createElement('span');
                            dot.title = 'This module is disabled and will not load until re-enabled and restarted.';
                            dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#c84c4c;flex-shrink:0;';
                            nameWrap.appendChild(dot);
                        } else if (enabled) {
                            const dot = document.createElement('span');
                            dot.title = 'This module has active settings';
                            dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#0ac8b9;flex-shrink:0;';
                            nameWrap.appendChild(dot);
                        }

                        const nameEl = document.createElement('span');
                        nameEl.textContent = mod.name;
                        nameEl.style.cssText = 'font-size:12px;color:#f0e6d2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (isDisabled ? 'opacity:0.5;' : '');
                        nameWrap.appendChild(nameEl);

                        const actionsWrap = document.createElement('div');
                        actionsWrap.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

                        actions.forEach(action => {
                            const btn = document.createElement('button');
                            btn.textContent = typeof action.label === 'function' ? action.label(mod) : action.label;
                            btn.className = action.className || '';
                            btn.style.cssText = 'flex-shrink:0;padding:2px 8px;font-size:11px;border-radius:2px;cursor:pointer;border:1px solid rgba(200,170,110,0.3);background:rgba(200,170,110,0.06);color:#c8aa6e;transition:all 0.15s;';
                            btn.onmouseover = () => {
                                btn.style.background = 'rgba(200,170,110,0.15)';
                                btn.style.color = '#f0e6d2';
                            };
                            btn.onmouseout = () => {
                                btn.style.background = 'rgba(200,170,110,0.06)';
                                btn.style.color = '#c8aa6e';
                            };
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                action.onClick(mod.id);
                            });
                            actionsWrap.appendChild(btn);
                        });

                        item.appendChild(nameWrap);
                        item.appendChild(actionsWrap);
                        list.appendChild(item);
                    });

                    col.appendChild(list);
                    return col;
                }

                function toggleVisibility(modId) {
                    const current = (() => {
                        const v = Utils.Store.get('core', 'hiddenModules');
                        return Array.isArray(v) ? new Set(v) : new Set();
                    })();

                    const tabEl = document.querySelector(`#pm-root .pm-tab[data-target="tab-${modId}"]`);

                    if (current.has(modId)) {
                        current.delete(modId);
                        if (tabEl) tabEl.style.display = '';
                    } else {
                        current.add(modId);
                        if (tabEl) {
                            tabEl.style.display = 'none';
                            if (tabEl.classList.contains('active')) {
                                document.querySelector('#pm-root .pm-tab[data-target="tab-lookup"]')?.click();
                            }
                        }
                    }

                    Utils.Store.set('core', 'hiddenModules', [...current]);
                    buildVisibilityList();
                }

                function toggleDisabled(modId) {
                    const current = getDisabledModuleIds();
                    if (current.has(modId)) {
                        current.delete(modId);
                        if (!registeredModules.some(m => m.id === modId)) {
                            registeredModules.push({
                                id: modId,
                                name: (getModuleInfo()[modId] || {}).name || modId,
                                description: '',
                                settings: [],
                            });
                        }
                    } else {
                        current.add(modId);
                    }
                    Utils.Store.set('core', 'disabledModules', [...current]);
                    buildVisibilityList();
                }

                const leftCol = makeColumn(t('Visible in Menu'), visibleMods, [{
                    label: t('Hide'),
                    className: 'pm-vis-hide-btn',
                    onClick: toggleVisibility
                }]);
                const rightCol = makeColumn(t('Hidden from Menu'), hiddenMods, [{
                        label: (mod) => disabledIds.has(mod.id) ? t('Enable') : t('Disable'),
                        onClick: toggleDisabled
                    },
                    {
                        label: t('Show'),
                        className: 'pm-vis-show-btn',
                        onClick: toggleVisibility
                    }
                ]);

                visDualList.appendChild(leftCol);
                visDualList.appendChild(rightCol);

                visDualList.querySelectorAll('div[style*="overflow-y: auto"]').forEach((el, i) => {
                    if (_prevScrollTops[i] != null) el.scrollTop = _prevScrollTops[i];
                });
            }

            buildVisibilityList();
            visSection.appendChild(visDualList);

            const _restartDisabledCount = getDisabledModuleIds().size;
            if (_restartDisabledCount > 0) {
                const restartNote = document.createElement('div');
                restartNote.style.cssText = 'font-size:11px;color:#a09b8c;margin-top:8px;padding:6px 10px;border-radius:4px;background:rgba(200,170,110,0.06);border:1px solid rgba(200,170,110,0.15);display:flex;align-items:center;gap:6px;';
                restartNote.innerHTML = '<span style="color:#c8aa6e;font-weight:700;">!</span> ' + t('Restart required for module enable/disable changes to take effect.');
                visSection.appendChild(restartNote);
            }

            wrap.appendChild(visSection);

            container.appendChild(wrap);
        }
        // End Settings Tab 

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

                // Prevent typing from triggering the modal
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

    return {
        init,
        show,
        hide,
        toggle,
        onChange,
        destroy
    };
})();
