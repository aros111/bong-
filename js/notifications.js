// ══════════════════════════════════════════════════════════════
// MODUL: NOTIFICATIONS & CLEANUP
// Überwachung von Fristen und 10-Jahre-Löschlogik (GoBD)
// ══════════════════════════════════════════════════════════════
'use strict';

const NotificationModule = (() => {

  async function init() {
    BSP.on('core:ready', () => {
      checkDeadlines();
      runCleanupTask();
    });
  }

  async function checkDeadlines() {
    const fristen = await BSP.dbGetAll('archiv_fristen');
    const today = new Date();
    const critical = fristen.filter(f => {
      const days = (new Date(f.date) - today) / 864e5;
      return days >= 0 && days <= 3;
    });

    if (critical.length) {
      BSP.toast(`Achtung: ${critical.length} Fristen laufen bald ab! 🔔`, 'wr');
    }
  }

  async function runCleanupTask() {
    const settings = BSP.state.settings || {};
    if (settings.autoCleanup !== '1') return;

    // GoBD: 10 Jahre Aufbewahrungspflicht. Alles was älter ist, kann weg.
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 10);
    const cutoffTs = cutoff.getTime();

    const belege = await BSP.getBelege();
    const toDelete = belege.filter(b => {
      const bDate = b.date ? new Date(b.date).getTime() : b.savedAt;
      return bDate < cutoffTs;
    });

    if (toDelete.length > 0) {
      console.log(`Cleanup: Found ${toDelete.length} items older than 10 years.`);
      // In einer echten App würden wir hier erst fragen oder in einen "Papierkorb" verschieben.
      // Hier implementieren wir die Logik als automatischen Vorschlag.
      BSP.emit('cleanup:suggested', { count: toDelete.length });
    }
  }

  return { init, checkDeadlines, runCleanupTask };

})();
NotificationModule.init();
