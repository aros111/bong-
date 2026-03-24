// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV SHELL
// Verwaltet die Navigation und Views im Archiv-Bereich
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivShell = (() => {

  const NAV_ITEMS = [
    { id: 'home', name: 'Inbox', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>' },
    { id: 'archiv-docs', name: 'Archiv', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' },
    { id: 'archiv-fristen', name: 'Fristen', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
    { id: 'archiv-kontext', name: 'Gedächtnis', icon: '🧠' },
    { id: 'archiv-reise', name: 'Reise', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>' },
    { id: 'archiv-tagebuch', name: 'Tagebuch', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
    { id: 'einstellungen', name: 'Setup', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1V15a2 2 0 01-2-2 2 2 0 012-2v-.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2v.09a1.65 1.65 0 00-1.51 1z"/></svg>' }
  ];

  function _generateNavHTML() {
    return NAV_ITEMS.map((item, index) => `
      <button class="nav-btn${index === 0 ? ' on' : ''}" data-nav="${item.id}" onclick="BSP.showView('${item.id}')">
        ${item.icon.startsWith('<svg') ? item.icon : `<span class="icon-emoji">${item.icon}</span>`}
        <span>${item.name}</span>
      </button>
    `).join('');
  }

  function init() {
    BSP.on('pillar:changed', ({ pillar }) => {
      if (pillar === 'archiv') _activate();
    });
    
    if (BSP.state.currentPillar === 'archiv') _activate();
  }

  function _activate() {
    document.body.className = 'p-archiv';
    const nav = document.getElementById('shell-nav');
    if (nav) {
      nav.innerHTML = _generateNavHTML();
    }
    BSP.showView('home'); // Standardmäßig Inbox/Home
  }

  return { init, activate: _activate };

})();
ArchivShell.init();
