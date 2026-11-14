import Utils from '../utils.js';
import { getMenuHotkey } from '../registry.js';

const HEXTECH_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;pointer-events:none;">
  <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="miter"/>
  <path d="M12 6.5L16.5 9.25V14.75L12 17.5L7.5 14.75V9.25L12 6.5Z" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.3"/>
  <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
</svg>
`;

export const TopBar = (function() {
    let _cleanupObserver = null;
    let _pollTimer = null;

    function mountButton(onToggle) {
        const lowerDetails = document.querySelector('.lol-social-identity .lower-details')
            || document.querySelector('.lower-details');
        if (!lowerDetails) return;

        let btn = document.getElementById('hm-topbar-btn');
        if (btn && lowerDetails.contains(btn)) return;
        if (btn) btn.remove();

        const hk = getMenuHotkey()?.display || 'F1';
        btn = document.createElement('div');
        btn.id = 'hm-topbar-btn';
        btn.className = 'hm-topbar-icon-btn';
        btn.title = `Hex-Manager (${hk})`;
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:18px',
            'height:18px',
            'margin-right:4px',
            'cursor:pointer',
            'color:#cdbe91',
            'transition:color 0.15s ease, transform 0.15s ease, filter 0.15s ease',
            'pointer-events:auto',
            '-webkit-app-region:no-drag',
            'user-select:none',
            'flex-shrink:0'
        ].join(';');
        btn.innerHTML = HEXTECH_ICON_SVG;

        btn.addEventListener('mouseenter', () => {
            btn.style.color = '#f0e6d2';
            btn.style.filter = 'drop-shadow(0 0 4px rgba(200, 170, 110, 0.75))';
            btn.style.transform = 'scale(1.08)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.color = '#cdbe91';
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onToggle === 'function') onToggle();
        });

        const anchor = lowerDetails.querySelector('.honor-button')
            || lowerDetails.querySelector('lol-player-notifications-button')
            || lowerDetails.lastElementChild;
        if (anchor) {
            lowerDetails.insertBefore(btn, anchor);
        } else {
            lowerDetails.appendChild(btn);
        }
    }

    function init(onToggle) {
        mountButton(onToggle);
        if (_cleanupObserver) _cleanupObserver();
        _cleanupObserver = Utils.DOM.observer.observe('.lower-details', () => {
            mountButton(onToggle);
        });
        if (_pollTimer) clearInterval(_pollTimer);
        _pollTimer = setInterval(() => mountButton(onToggle), 2000);
    }

    function destroy() {
        if (_cleanupObserver) _cleanupObserver();
        _cleanupObserver = null;
        if (_pollTimer) clearInterval(_pollTimer);
        _pollTimer = null;
        document.getElementById('hm-topbar-btn')?.remove();
    }

    return { init, destroy };
})();
