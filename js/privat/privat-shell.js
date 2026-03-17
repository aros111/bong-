// ══════════════════════════════════════════════════════════════
// MODUL: PRIVAT SHELL
// Verwaltet die Navigation und Views im Privat-Bereich
// ══════════════════════════════════════════════════════════════
'use strict';

const PrivatShell = (() => {

  const NAV_ITEMS = [
    { id: 'home', name: 'Life', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>' },
    { id: 'privat-spending', name: 'Analysen', icon: '📊' },
    { id: 'privat-deals', name: 'Deals', icon: '🏷️' },
    { id: 'privat-energie', name: 'Energie', icon: '⚡' },
    { id: 'privat-ziele', name: 'Ziele', icon: '🎯' },
    { id: 'einstellungen', name: 'Setup', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1V15a2 2 0 01-2-2 2 2 0 012-2v-.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2v.09a1.65 1.65 0 00-1.51 1z"/></svg>' }
  ];

  function _generateNavHTML() {
    return NAV_ITEMS.map((item, index) => `
      <button class="ni${index === 0 ? ' on' : ''}" data-nav="${item.id}" onclick="BSP.showView('${item.id}')">
        ${item.icon.startsWith('<svg') ? item.icon : `<span class="icon-emoji">${item.icon}</span>`}
        ${item.name}
      </button>
    `).join('');
  }

  function init() {
    BSP.on('pillar:changed', ({ pillar }) => {
      if (pillar === 'privat') _activate();
    });
    
    // Initialer Check falls die App schon im Privat-Modus startet
    if (BSP.state.currentPillar === 'privat') _activate();
  }

  function _activate() {
    document.body.className = 'p-privat';
    const nav = document.getElementById('shell-nav');
    if (nav) nav.innerHTML = _generateNavHTML();
    BSP.showView('privat-home');
  }

  return { init };

})();
PrivatShell.init();
