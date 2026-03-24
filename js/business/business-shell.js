// ══════════════════════════════════════════════════════════════
// MODUL: BUSINESS SHELL
// Verwaltet die Navigation und Views im Business-Bereich
// ══════════════════════════════════════════════════════════════
'use strict';

const BusinessShell = (() => {

  const NAV_HTML = `
    <button class="ni on" data-nav="home" onclick="BSP.showView('home')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
      Home
    </button>
    <button class="ni" data-nav="belege" onclick="BSP.showView('belege')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      Belege
    </button>
    <button class="ni" data-nav="steuer" onclick="BSP.showView('steuer')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h10"/></svg>
      Steuer
    </button>
    <button class="ni" data-nav="einstellungen" onclick="BSP.showView('einstellungen')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1V15a2 2 0 01-2-2 2 2 0 012-2v-.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2v.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Setup
    </button>
  `;

  function init() {
    BSP.on('pillar:changed', ({ pillar }) => {
      if (pillar === 'business') _activate();
    });
    
    // Initial aktiv wenn Business
    if (_currentPillar === 'business') _activate();
  }

  function _activate() {
    const nav = document.getElementById('nav');
    if (nav) nav.innerHTML = NAV_HTML;
  }

  return { init };
})();
