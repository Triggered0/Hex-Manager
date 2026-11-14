export const STYLE_CONTENT = `
      #pm-root { position: fixed; inset: 0; z-index: 2147483647; display: none; align-items: center; justify-content: center; font-family: "Spiegel", var(--font-body), "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
      #pm-root.pm-show { display: flex; }
      #pm-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); pointer-events: auto; }
      #pm-modal { position: relative; z-index: 1; width: 850px; height: 600px; max-height: 85vh; background: rgba(1, 10, 19, 0.75); border: 1px solid rgba(200, 170, 110, 0.2); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; color: #a09b8c; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05); backdrop-filter: blur(25px) saturate(140%); pointer-events: auto; }
      .pm-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.2); flex-shrink: 0; }
      .pm-title { color: #f0e6d2; font-size: 20px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
      .pm-close { background: none; border: none; color: #a09b8c; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.15s; }
      .pm-close:hover { color: #f0e6d2; }
      .pm-body { display: flex; flex: 1; overflow: hidden; }
      .pm-sidebar { width: 240px; border-right: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; overflow-y: auto; background: rgba(0, 0, 0, 0.1); flex-shrink: 0; }
      .pm-tab { padding: 14px 20px; cursor: pointer; color: #a09b8c; font-size: 14px; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.02); transition: all 0.2s ease; border-left: 3px solid transparent; }
      .pm-tab:hover { background: rgba(200, 170, 110, 0.08); color: #f0e6d2; }
      .pm-tab.active { background: rgba(200, 170, 110, 0.15); color: #c8aa6e; border-left-color: #c8aa6e; }
      .pm-content { flex: 1; padding: 18px; overflow-y: auto; position: relative; }
      .pm-tab-content { display: none; animation: fadeIn 0.2s ease-in-out; }
      .pm-tab-content.active { display: block; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      .pm-section-title { color: #c8aa6e; font-size: 18px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }
      .pm-search { display: flex; gap: 8px; margin-bottom: 12px; }
      .pm-input { flex: 1; background: #111; border: 1px solid #3e2e13; color: #f0e6d2; padding: 8px 14px; border-radius: 2px; outline: none; font-size: 13px; transition: border-color 0.2s, background-color 0.2s; }
      .pm-input:focus { border-color: #c8aa6e; background: rgba(0, 0, 0, 0.5); }
      .pm-btn { background: rgba(200, 170, 110, 0.08); border: 1px solid rgba(200, 170, 110, 0.25); color: #c8aa6e; padding: 8px 10px; cursor: pointer; border-radius: 2px; font-weight: bold; transition: all 0.2s ease; font-size: 13px; }
      .pm-btn:hover { background: rgba(200, 170, 110, 0.16); color: #f0e6d2; border-color: #c8aa6e; }
      .pm-row { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.03); margin-bottom: 10px; border-radius: 8px; transition: all 0.2s ease; }
      .pm-row:hover { background: rgba(255, 255, 255, 0.04); border-color: rgba(200, 170, 110, 0.15); }
      .pm-label-wrapper { display: flex; flex-direction: column; gap: 6px; flex: 1; pointer-events: none; }
      .pm-label-title { color: #f0e6d2; font-size: 15px; font-weight: bold; pointer-events: none; }
      .pm-label-desc { color: #a09b8c; font-size: 12px; pointer-events: none; line-height: 1.4; }
      
      /* Pill Toggle styles */
      .pm-toggle-btn { width: 44px; height: 22px; border-radius: 11px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(200, 170, 110, 0.2); position: relative; cursor: pointer; transition: 0.3s ease; flex-shrink: 0; outline: none; padding: 0; }
      .pm-toggle-btn.on { background: #0ac8b9; border-color: #0ac8b9; }
      .pm-toggle-btn::after { content: ''; position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; background: #a09b8c; border-radius: 50%; transition: 0.3s cubic-bezier(0.2, 0.85, 0.32, 1.2); pointer-events: none; }
      .pm-toggle-btn.on::after { left: 23px; background: #010a13; }
      .pm-toggle-btn:hover::after { background: #f0e6d2; }
      .pm-toggle-btn.on:hover::after { background: #fff; }
      
      .pm-sidebar::-webkit-scrollbar, .pm-content::-webkit-scrollbar { width: 6px; }
      .pm-sidebar::-webkit-scrollbar-track, .pm-content::-webkit-scrollbar-track { background: transparent; }
      .pm-sidebar::-webkit-scrollbar-thumb, .pm-content::-webkit-scrollbar-thumb { background: rgba(200, 170, 110, 0.15); border-radius: 3px; }
      .pm-sidebar::-webkit-scrollbar-thumb:hover, .pm-content::-webkit-scrollbar-thumb:hover { background: rgba(200, 170, 110, 0.3); }

      /* Settings tab */
      .pm-tab-settings { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px; }
      .pm-tab-settings svg { flex-shrink: 0; opacity: 0.7; }
      .pm-tab-settings.active svg { opacity: 1; }
      .pm-settings-section { margin-bottom: 24px; }
      .pm-settings-section-title { color: #c8aa6e; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
      .pm-settings-section-desc { color: #4a6070; font-size: 12px; line-height: 1.5; margin-bottom: 10px; }
      .pm-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; background: rgba(255,255,255,0.015); }
      .plugins-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; background: rgba(255,255,255,0.015); color: #a09b8c; }
      .plugins-settings-row label,
      .plugins-settings-row span,
      .plugins-settings-row .pm-label-title,
      .plugins-settings-row .pm-label-desc { color: #a09b8c; }
      .pm-settings-row-label { font-size: 13px; color: #8a9aaa; }
      .pm-update-status { margin-top: 10px; padding: 8px 10px; background: rgba(0,0,0,0.2); border: 1px solid #1a2535; font-size: 12px; line-height: 1.6; border-radius: 4px; }
      .pm-update-status.has-update { border-color: #785a28; background: rgba(200,170,110,0.06); }
      .pm-update-title { font-size: 13px; font-weight: 600; color: #c8aa6e; margin-bottom: 4px; }
      .pm-update-rel-name { font-size: 12px; color: #8a9aaa; margin-bottom: 6px; }
      .pm-update-notes { font-size: 12px; color: #4a6070; margin-bottom: 8px; white-space: pre-wrap; max-height: 80px; overflow: hidden; }
      .pm-update-link { font-size: 12px; color: #785a28; text-decoration: underline; cursor: pointer; }
      .pm-update-check-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
      .pm-update-check-status { font-size: 12px; color: #4a6070; }
`;
