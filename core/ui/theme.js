export const STYLE_CONTENT = `
  #pm-root {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: none;
    align-items: center;
    justify-content: center;
    font-family: "Spiegel", var(--font-body), "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  #pm-root.pm-show {
    display: flex;
  }
  #pm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(1, 5, 10, 0.72);
    pointer-events: auto;
  }
  #pm-modal {
    position: relative;
    z-index: 1;
    width: 920px;
    height: 640px;
    max-height: 88vh;
    background: radial-gradient(ellipse at 50% 0%, rgba(22, 42, 62, 0.45) 0%, #010a13 70%);
    border: 2px solid #785a28;
    border-radius: 2px;
    box-shadow: 0 0 0 1px #010a13, inset 0 0 0 1px rgba(200, 170, 110, 0.16), 0 22px 60px rgba(0, 0, 0, 0.88);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #a09b8c;
    pointer-events: auto;
  }
  #pm-modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #c8aa6e 50%, transparent);
    pointer-events: none;
    z-index: 3;
  }
  .pm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid #3c3728;
    background: linear-gradient(180deg, rgba(16, 26, 36, 0.92) 0%, rgba(1, 10, 19, 0.95) 100%);
    flex-shrink: 0;
  }
  .hm-brand-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .hm-brand-crest {
    color: #c8aa6e;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pm-title {
    color: #f0e6d2;
    font-family: "BeaufortforLOL", serif;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .hm-active-badge {
    font-size: 11px;
    font-weight: 700;
    color: #c8aa6e;
    background: rgba(200, 170, 110, 0.1);
    border: 1px solid rgba(200, 170, 110, 0.35);
    padding: 2px 8px;
    border-radius: 2px;
    letter-spacing: 0.5px;
  }
  .hm-header-search-wrap {
    position: relative;
    flex: 1;
    max-width: 320px;
    display: flex;
    align-items: center;
  }
  .hm-header-search-icon {
    position: absolute;
    left: 10px;
    color: #785a28;
    pointer-events: none;
    display: flex;
  }
  #hm-mod-search {
    width: 100%;
    background: #050e17;
    border: 1px solid #463714;
    color: #f0e6d2;
    padding: 6px 28px 6px 30px;
    border-radius: 2px;
    outline: none;
    font-size: 12px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  #hm-mod-search:focus {
    border-color: #c8aa6e;
    box-shadow: 0 0 6px rgba(200, 170, 110, 0.25);
  }
  .hm-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .hm-hotkey-pill {
    font-size: 11px;
    color: #a09b8c;
    background: #091420;
    border: 1px solid #2b3844;
    padding: 3px 8px;
    border-radius: 2px;
    font-family: monospace;
  }
  .pm-close {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #091420;
    border: 1px solid #463714;
    color: #cdbe91;
    font-size: 15px;
    cursor: pointer;
    padding: 0;
    border-radius: 2px;
    transition: all 0.15s ease;
  }
  .pm-close:hover {
    color: #f0e6d2;
    border-color: #c8aa6e;
    background: rgba(200, 170, 110, 0.18);
  }
  .pm-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .pm-sidebar {
    width: 220px;
    border-right: 1px solid #2c281d;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #030c14;
    flex-shrink: 0;
    padding: 8px 0;
  }
  .pm-tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    cursor: pointer;
    color: #a09b8c;
    font-family: "BeaufortforLOL", serif;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid rgba(200, 170, 110, 0.05);
    transition: all 0.15s ease;
  }
  .hm-tab-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .hm-tab-icon {
    color: #785a28;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }
  .hm-tab-count {
    font-family: "Spiegel", sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #5b5a56;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 1px 6px;
    border-radius: 2px;
  }
  .pm-tab:hover {
    background: linear-gradient(90deg, rgba(200, 170, 110, 0.08), transparent);
    color: #f0e6d2;
  }
  .pm-tab:hover .hm-tab-icon {
    color: #c8aa6e;
  }
  .pm-tab.active {
    background: linear-gradient(90deg, rgba(200, 170, 110, 0.18), transparent);
    color: #f0e6d2;
    border-left-color: #c8aa6e;
  }
  .pm-tab.active .hm-tab-icon {
    color: #c8aa6e;
  }
  .pm-tab.active .hm-tab-count {
    color: #c8aa6e;
    border-color: rgba(200, 170, 110, 0.4);
    background: rgba(200, 170, 110, 0.12);
  }
  .pm-content {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
    position: relative;
    background: #010a13;
  }
  .pm-tab-content {
    display: none;
    animation: fadeIn 0.15s ease-out;
  }
  .pm-tab-content.active {
    display: block;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .pm-section-title {
    color: #f0e6d2;
    font-family: "BeaufortforLOL", serif;
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 4px 0;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .hm-cat-subtitle {
    color: #7e7968;
    font-size: 12px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(200, 170, 110, 0.15);
  }

  /* Module Cards */
  .hm-mod-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hm-mod-card {
    background: #05101a;
    border: 1px solid #1e282d;
    border-left: 2px solid #3c3728;
    border-radius: 2px;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .hm-mod-card.is-enabled {
    border-color: rgba(120, 90, 40, 0.65);
    border-left: 2px solid #c8aa6e;
    background: linear-gradient(180deg, rgba(14, 28, 42, 0.65) 0%, #05101a 100%);
  }
  .hm-mod-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
  }
  .hm-mod-card-header:hover {
    background: rgba(200, 170, 110, 0.04);
  }
  .hm-mod-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .hm-mod-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hm-mod-title {
    color: #f0e6d2;
    font-family: "BeaufortforLOL", serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  .hm-mod-desc {
    color: #8c8778;
    font-size: 12px;
    line-height: 1.4;
  }
  .hm-mod-body {
    padding: 10px 16px 14px 16px;
    border-top: 1px solid rgba(200, 170, 110, 0.1);
    background: rgba(1, 7, 14, 0.55);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Sharp Hextech Switch (Replaces iOS pill toggle) */
  .pm-toggle-btn, .hm-hex-switch {
    width: 42px;
    height: 20px;
    border-radius: 2px;
    background: #091119;
    border: 1px solid #463714;
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    outline: none;
    padding: 0;
  }
  .pm-toggle-btn.on, .hm-hex-switch.on {
    background: linear-gradient(90deg, rgba(10, 200, 185, 0.22), rgba(200, 170, 110, 0.28));
    border-color: #c8aa6e;
    box-shadow: 0 0 8px rgba(200, 170, 110, 0.22);
  }
  .pm-toggle-btn::after, .hm-hex-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 4px;
    width: 12px;
    height: 12px;
    background: #5b5a56;
    border: 1px solid #3c3728;
    transform: rotate(45deg);
    transition: all 0.2s cubic-bezier(0.2, 0.85, 0.32, 1.2);
    pointer-events: none;
  }
  .pm-toggle-btn.on::after, .hm-hex-switch.on::after {
    left: 24px;
    background: #f0e6d2;
    border-color: #c8aa6e;
    box-shadow: 0 0 6px #c8aa6e;
  }

  .pm-search { display: flex; gap: 8px; margin-bottom: 12px; }
  .pm-input { flex: 1; background: #050e17; border: 1px solid #463714; color: #f0e6d2; padding: 8px 14px; border-radius: 2px; outline: none; font-size: 13px; transition: border-color 0.2s; }
  .pm-input:focus { border-color: #c8aa6e; }
  .pm-btn { background: linear-gradient(180deg, #1e2328 0%, #0f171e 100%); border: 1px solid #785a28; color: #cdbe91; padding: 7px 14px; cursor: pointer; border-radius: 2px; font-family: "BeaufortforLOL", serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; transition: all 0.15s ease; font-size: 12px; }
  .pm-btn:hover { background: linear-gradient(180deg, #2a3038 0%, #17222c 100%); color: #f0e6d2; border-color: #c8aa6e; box-shadow: 0 0 8px rgba(200, 170, 110, 0.25); }
  .pm-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(200, 170, 110, 0.08); border-radius: 2px; transition: all 0.15s ease; }
  .pm-row:hover { border-color: rgba(200, 170, 110, 0.22); }
  .pm-label-wrapper { display: flex; flex-direction: column; gap: 4px; flex: 1; pointer-events: none; }
  .pm-label-title { color: #f0e6d2; font-size: 13px; font-weight: 600; pointer-events: none; }
  .pm-label-desc { color: #8c8778; font-size: 11px; pointer-events: none; line-height: 1.4; }

  .pm-sidebar::-webkit-scrollbar, .pm-content::-webkit-scrollbar { width: 5px; }
  .pm-sidebar::-webkit-scrollbar-track, .pm-content::-webkit-scrollbar-track { background: #010a13; }
  .pm-sidebar::-webkit-scrollbar-thumb, .pm-content::-webkit-scrollbar-thumb { background: #463714; border-radius: 1px; }
  .pm-sidebar::-webkit-scrollbar-thumb:hover, .pm-content::-webkit-scrollbar-thumb:hover { background: #785a28; }

  /* Settings tab */
  .pm-tab-settings { margin-top: auto; border-top: 1px solid #2c281d; }
  .pm-settings-section { margin-bottom: 22px; background: #05101a; border: 1px solid #1e282d; border-left: 2px solid #785a28; padding: 14px 16px; border-radius: 2px; }
  .pm-settings-section-title { color: #c8aa6e; font-family: "BeaufortforLOL", serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .pm-settings-section-desc { color: #7e7968; font-size: 12px; line-height: 1.5; margin-bottom: 10px; }
  .pm-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding: 10px 12px; border: 1px solid rgba(200, 170, 110, 0.08); border-radius: 2px; background: rgba(1, 10, 19, 0.6); }
  .plugins-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding: 10px 12px; border: 1px solid rgba(200, 170, 110, 0.08); border-radius: 2px; background: rgba(1, 10, 19, 0.6); color: #a09b8c; }
  .plugins-settings-row label,
  .plugins-settings-row span,
  .plugins-settings-row .pm-label-title,
  .plugins-settings-row .pm-label-desc { color: #a09b8c; }
  .pm-settings-row-label { font-size: 13px; color: #cdbe91; }
  .pm-update-status { margin-top: 10px; padding: 8px 10px; background: #010a13; border: 1px solid #1e282d; font-size: 12px; line-height: 1.6; border-radius: 2px; }
  .pm-update-status.has-update { border-color: #c8aa6e; background: rgba(200, 170, 110, 0.08); }
  .pm-update-title { font-size: 13px; font-weight: 600; color: #c8aa6e; margin-bottom: 4px; }
  .pm-update-rel-name { font-size: 12px; color: #8a9aaa; margin-bottom: 6px; }
  .pm-update-notes { font-size: 12px; color: #7e7968; margin-bottom: 8px; white-space: pre-wrap; max-height: 80px; overflow: hidden; }
  .pm-update-link { font-size: 12px; color: #c8aa6e; text-decoration: underline; cursor: pointer; }
  .pm-update-check-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .pm-update-check-status { font-size: 12px; color: #7e7968; }
`;
