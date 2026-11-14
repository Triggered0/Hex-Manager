import Utils from '../utils.js';

export const TopBar = (function() {
    let _cleanupObserver = null;

    function mountButton(onToggle) {
        if (document.getElementById('hm-topbar-btn')) return;

        const rightNav = document.querySelector('.right-nav-vertical-rule')?.parentElement
            || document.querySelector('.lol-social-lower-pane-container')?.parentElement;
        if (!rightNav) return;

        const btn = document.createElement('div');
        btn.id = 'hm-topbar-btn';
        btn.title = 'Hex-Manager (F1)';
        btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;cursor:pointer;color:#c8aa6e;font-family:"BeaufortforLOL",serif;font-weight:700;font-size:13px;letter-spacing:0.5px;border:1px solid rgba(200,170,110,0.35);border-radius:4px;margin:0 6px;background:rgba(1,10,19,0.75);transition:all 0.2s ease;user-select:none;';
        btn.textContent = 'HEX';
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = '#c8aa6e';
            btn.style.color = '#f0e6d2';
            btn.style.background = 'rgba(200,170,110,0.18)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'rgba(200,170,110,0.35)';
            btn.style.color = '#c8aa6e';
            btn.style.background = 'rgba(1,10,19,0.75)';
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onToggle === 'function') onToggle();
        });

        rightNav.insertBefore(btn, rightNav.firstChild);
    }

    function init(onToggle) {
        mountButton(onToggle);
        if (_cleanupObserver) _cleanupObserver();
        _cleanupObserver = Utils.DOM.observer.observe('.right-nav-vertical-rule', () => {
            mountButton(onToggle);
        });
    }

    function destroy() {
        if (_cleanupObserver) _cleanupObserver();
        _cleanupObserver = null;
        document.getElementById('hm-topbar-btn')?.remove();
    }

    return { init, destroy };
})();
