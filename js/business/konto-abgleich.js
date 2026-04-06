// ══════════════════════════════════════════════════════════════
// MODUL: KONTO ABGLEICH
// Reines Matching-Modul ohne UI.
// Legt importierte Buchungen in DB ab und sucht nach Belegen
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoAbgleich = (() => {

  async function executeAlgorithm(transactions, bankId) {
    const alleBelege = await BSP.getBelege();
    const arBelege = alleBelege.filter(b => b.type === 'ar');
    let existingKonto = [];
    if (BSP.dbGetAll) existingKonto = await BSP.dbGetAll('konto') || [];

    for (let txn of transactions) {
      txn.bankId = bankId; // Bank Zuordnung sicherstellen
      txn.tags = { kontoTyp: 'Business', ausgabenTyp: 'Business', mismatch: false };
      txn.status = 'offen';
      
      txn.auftraggeber = txn.auftraggeber || txn.empfaenger || '';
      txn.buchungstyp = txn.buchungstyp || txn.typ || 'Sonstige';
      txn.kontoId = txn.kontoId || txn.iban || 'unbekannt';

      const duplicate = existingKonto.find(e => 
        e.datum === txn.datum && 
        Math.abs(e.betrag - txn.betrag) < 0.05 && 
        (e.empfaenger || '').toLowerCase() === (txn.empfaenger || '').toLowerCase()
      );

      if (duplicate) txn.isDuplicateAlert = true;

      // Abgleich Geldeingänge gegen AR-Belege
      if (txn.betrag > 0) {
        const possibleAR = arBelege.filter(b => {
          if (!b.date || !b.brutto) return false;
          const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(txn.datum+'T00:00:00')) / 864e5);
          if (daysDiff > 3) return false; // ±3 Tage
          const amtDiff = Math.abs(Math.abs(b.brutto) - Math.abs(txn.betrag));
          if (amtDiff > 0.50) return false; // ±50 Cent
          return true;
        });

        let bestARMatch = null;
        let scoreMax = 0;

        for (let m of possibleAR) {
          let sc = 0;
          const bEmpf = (m.empfaenger || m.shop || '').toLowerCase();
          const tShop = (txn.empfaenger || '').toLowerCase();
          
          if (tShop.includes(bEmpf.split(' ')[0]) || bEmpf.includes(tShop.split(' ')[0])) sc += 5;
          
          // Neue Toleranz: 50 Cent (50 Cent diff = +1 Punkt, 5 Cent Diff = +4 Punkte, Exact = +5)
          const diff = Math.abs(Math.abs(m.brutto) - Math.abs(txn.betrag));
          if (diff === 0) sc += 5;
          else if (diff <= 0.05) sc += 4;
          else if (diff <= 0.50) sc += 1;
          
          if (m.date === txn.datum) sc += 2;

          if (sc > scoreMax) { scoreMax = sc; bestARMatch = m; }
        }

        // Benötige mind 3 Punkte für ein Match
        if (scoreMax >= 3 && bestARMatch) {
          txn.status = 'abgeglichen';
          txn.belegId = bestARMatch.id;
          txn.belegNr = bestARMatch.belegNr;
        } else {
          txn.hasAlert = '⚠️ Mögliche fehlende Ausgangsrechnung';
        }
      } else {
        // Abgleich Ausgaben gegen ER-Belege
        const possibleBelege = alleBelege.filter(b => {
          if (!b.date || !b.brutto) return false;
          const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(txn.datum+'T00:00:00')) / 864e5);
          if (daysDiff > 3) return false; // ±3 Tage
          const amtDiff = Math.abs(Math.abs(b.brutto) - Math.abs(txn.betrag));
          if (amtDiff > 0.50) return false; // ±50 Cent
          return true;
        });

        let bestMatch = null;
        let scoreMax = 0;

        for (let m of possibleBelege) {
          let sc = 0;
          const bShop = (m.shop || '').toLowerCase();
          const tShop = (txn.empfaenger || '').toLowerCase();
          
          if (tShop.includes(bShop) || bShop.includes(tShop)) sc += 5;
          if (tShop.includes('amzn') && bShop.includes('amazon')) sc += 5;
          if (tShop.includes('pp.') && bShop.includes('paypal')) sc += 5;
          
          const diff = Math.abs(Math.abs(m.brutto) - Math.abs(txn.betrag));
          if (diff === 0) sc += 5;
          else if (diff <= 0.05) sc += 4;
          else if (diff <= 0.50) sc += 1;
          
          if (m.date === txn.datum) sc += 2;

          if (sc > scoreMax) { scoreMax = sc; bestMatch = m; }
        }

        if (scoreMax >= 5 && bestMatch) {
          txn.status = 'abgeglichen';
          txn.belegId = bestMatch.id;
        }
      }

      if (txn.typ === 'Rücklastschrift') {
        txn.hasAlert = 'Zahlung fehlgeschlagen';
      } else if (txn.typ === 'Bargeldabhebung') {
        txn.status = 'manuell';
      }

      txn.id = Date.now() + Math.floor(Math.random()*1000);
      txn.savedAt = Date.now();
    }
    
    // In DB ablegen
    for (let txn of transactions) {
      await BSP.dbAdd('konto', txn);
    }

    const unmatched = transactions.filter(txn => txn.status !== 'abgeglichen' && txn.status !== 'manuell');
    if (unmatched.length > 0 && typeof ReviewWorkflowModule !== 'undefined') {
      await ReviewWorkflowModule.startWithItems(unmatched);
    }

    BSP.toast('Transaktionen gesichert', 'ok');
    BSP.emit('konto:imported');
    
    // UI neu laden für aktive Bank
    if (typeof KontoUebersicht !== 'undefined') KontoUebersicht.renderList(bankId);
  }

  return { executeAlgorithm };

})();
