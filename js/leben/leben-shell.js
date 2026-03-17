/**
 * LEBEN-SHELL - Navigation und Modul-Management für die Leben-Säule
 */
const LebenShell = (function() {
  
  function init() {
    BSP.on('pillar:changed', ({ pillar }) => {
      if (pillar === 'leben') _activate();
    });
    console.log('🌱 LebenShell init');
  }

  function _activate() {
    document.body.className = 'p-leben';
    const nav = document.getElementById('shell-nav');
    if (nav) nav.innerHTML = _generateNavHTML();
    
    // Default View
    BSP.showView('leben-home');
    
    // Deadline-Ring Update für Leben
    _updateLebenRing();
  }

  function _generateNavHTML() {
    return `
      <button class="nav-btn on" data-nav="leben-home" onclick="BSP.showView('leben-home')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
        <span>Übersicht</span>
      </button>
      <button class="nav-btn" data-nav="leben-entwicklung" onclick="BSP.showView('leben-entwicklung')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
        <span>Entwicklung</span>
      </button>
      <button class="nav-btn" data-nav="leben-inflation" onclick="BSP.showView('leben-inflation')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
        <span>Inflation</span>
      </button>
      <button class="nav-btn" data-nav="leben-split" onclick="BSP.showView('leben-split')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>
        <span>Split</span>
      </button>
    `;
  }

  function _updateLebenRing() {
    // Im Leben-Modus zeigt der Ring z.B. das Monatsbudget-Wachstum oder Meilenstein-Fortschritt
    const ring = document.getElementById('deadline-ring-fill');
    const lbl = document.getElementById('deadline-label');
    if (!ring || !lbl) return;

    lbl.textContent = 'Wachstum';
    lbl.style.color = 'var(--accent)';
    
    const r = 44;
    const circ = 2 * Math.PI * r;
    ring.style.strokeDasharray = circ;
    ring.style.strokeDashoffset = circ * 0.4; // 60% Progress Beispiel
    ring.style.stroke = 'var(--accent)';
  }

  return { init, activate: _activate };
})();
