// ══════════════════════════════════════════════════════════════
// MODUL: REVIEW WORKFLOW
// Aufgabe 4 – Interaktive Durcharbeitung als performante State Machine
// Kern-Kreislauf: nach Kontoauszug-Import werden alle ungeklärten
// Buchungen Schritt für Schritt zugeordnet. Keine DB/API-Aufrufe
// während der Durcharbeitung – alles im Speicher, Batch-Save am Ende.
// ══════════════════════════════════════════════════════════════
'use strict';

const ReviewWorkflowModule = (() => {

// ── State Machine ─────────────────────────────────────────────
let _queue       = [];   // Alle zu klärenden Elemente (im Speicher)
let _cursor      = 0;    // Aktueller Index
let _changes     = {};   // Gesammelte Änderungen: {id: updatedItem}
let _belege      = [];   // Einmalig geladen, dann im Speicher
let _skr03Keys   = [];   // SKR03-Kategorien für schnelle Auswahl
let _paused      = false;// Workflow pausiert (z.B. AR-Scanner offen)
let _resumeCallback = null;

// ── Init ──────────────────────────────────────────────────────
function init() {
  BSP.on('konto:imported', () => _checkAndPromptReview());
  BSP.on('core:ready', async () => {
    await BSP.updatePendingBadge();
    await _checkResume();
  });
  // Nach AR-Scan: Workflow fortsetzen
  BSP.on('beleg:saved', (beleg) => {
    if (_paused && _resumeCallback && beleg && beleg.type === 'ar') {
      _paused = false;
      _resumeCallback(beleg);
      _resumeCallback = null;
    }
  });
}

// ── Prüfen ob offener Stand vorhanden → Wiederaufnahme ───────
async function _checkResume() {
  const pending = await BSP.prGetAll();
  const open = pending.filter(p => p.status === 'offen' || p.status === 'später_klären');
  if (open.length === 0) return;
  // Nur fragen falls nicht gerade eine andere View aktiv ist
  setTimeout(() => {
    const html = `
      <div class="sh"></div>
      <div style="font-size:18px;font-weight:200;letter-spacing:-.5px;margin-bottom:8px">Offene Buchungen</div>
      <div style="font-size:13px;color:var(--txt3);margin-bottom:20px">
        Du hast noch <strong style="color:var(--orn)">${open.length}</strong> ungeklärte Buchung${open.length!==1?'en':''}.<br>
        Möchtest du jetzt weitermachen?
      </div>
      <button style="width:100%;padding:16px;border:none;border-radius:var(--r16);background:var(--accent);color:#fff;font-size:15px;font-weight:500;cursor:pointer;margin-bottom:8px"
        onclick="BSP.closeSheet();setTimeout(()=>ReviewWorkflowModule.startFromPending(),200)">
        ▶ Weitermachen
      </button>
      <button class="btn btn-g" style="width:100%;justify-content:center" onclick="BSP.closeSheet()">Später</button>
    `;
    BSP.showSheet(html);
  }, 800);
}

// ── Start nach Kontoauszug-Import ─────────────────────────────
async function _checkAndPromptReview() {
  const pending = await BSP.prGetAll();
  const open = pending.filter(p => p.status === 'offen');
  if (open.length === 0) return;
  setTimeout(() => {
    const html = `
      <div class="sh"></div>
      <div style="font-size:18px;font-weight:200;letter-spacing:-.5px;margin-bottom:8px">Import abgeschlossen</div>
      <div style="font-size:13px;color:var(--txt3);margin-bottom:20px">
        <strong style="color:var(--orn)">${open.length}</strong> Buchung${open.length!==1?'en':''} noch ungeklärt.<br>
        Jetzt zuordnen? (ca. ${Math.ceil(open.length * 3)}s)
      </div>
      <button style="width:100%;padding:16px;border:none;border-radius:var(--r16);background:var(--accent);color:#fff;font-size:15px;font-weight:500;cursor:pointer;margin-bottom:8px"
        onclick="BSP.closeSheet();setTimeout(()=>ReviewWorkflowModule.startFromPending(),200)">
        ▶ Jetzt ${open.length} Buchungen klären
      </button>
      <button class="btn btn-g" style="width:100%;justify-content:center" onclick="BSP.closeSheet()">Später klären</button>
    `;
    BSP.showSheet(html);
  }, 400);
}

// ── Workflow starten (aus pending_review) ─────────────────────
async function startFromPending() {
  const pending = await BSP.prGetAll();
  _queue = pending.filter(p => p.status === 'offen' || p.status === 'später_klären');
  if (_queue.length === 0) { BSP.toast('Keine offenen Buchungen ✓', 'ok'); return; }
  await _startWorkflow();
}

// ── Workflow starten (direkt mit Buchungs-Array) ──────────────
async function startWithItems(items) {
  // items: Array von Buchungen aus konto-Store
  // Für jede Buchung einen pending_review Eintrag anlegen
  const existing = await BSP.prGetAll();
  const existingIds = new Set(existing.map(p => String(p.buchungsId)));
  for (const item of items) {
    const bid = String(item.id || item.buchungsId || '');
    if (existingIds.has(bid)) continue;
    await BSP.prAdd({
      buchungsId: item.id || null,
      kontoId: item.kontoId || item.iban || 'unbekannt',
      datum: item.datum || item.date || '',
      betrag: item.betrag || 0,
      zweck: item.zweck || item.verwendungszweck || '',
      auftraggeber: item.auftraggeber || item.empfaenger || '',
      typ: item.buchungstyp || item.typ || 'Sonstige',
      isPrivatKonto: item.isPrivatKonto || false,
      status: 'offen',
    });
  }
  await startFromPending();
}

// ── Workflow-Kern ─────────────────────────────────────────────
async function _startWorkflow() {
  // PERFORMANCE: Alles einmalig pre-laden, dann im Speicher
  _belege = await BSP.getBelege();
  _skr03Keys = BSP.DATEV ? Object.keys(BSP.DATEV.SKR03 || {}) : [];
  _cursor = 0;
  _changes = {};
  _paused = false;

  _renderStep();
}

function _renderStep() {
  if (_cursor >= _queue.length) {
    _finishWorkflow();
    return;
  }

  const item = _queue[_cursor];
  const total = _queue.length;
  const cur = _cursor + 1;

  // Übergangs-Modus: Privatkonto-Buchungen überspringen wenn inaktiv
  if (item.isPrivatKonto && !BSP.isTransitionModeActive()) {
    _skip();
    return;
  }

  const pct = Math.round(((_cursor) / total) * 100);
  const isEingang = item.betrag > 0;

  // Passende Belege nach Betrag + Datum für Vorschlag
  const matchedBelege = _belege.filter(b => {
    if (!b.date || !b.brutto) return false;
    const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(item.datum+'T00:00:00')) / 864e5);
    const amtDiff  = Math.abs(Math.abs(b.brutto) - Math.abs(item.betrag));
    return daysDiff <= 5 && amtDiff <= 2.0;
  }).slice(0, 3);

  // KI-Kategorie-Vorschlag (heuristisch, kein API-Call)
  const suggestedCat = _suggestCategory(item);

  const html = `
    <!-- Fortschrittsbalken -->
    <div style="height:3px;background:var(--bg3);border-radius:2px;margin-bottom:16px;overflow:hidden">
      <div style="height:100%;background:var(--accent);width:${pct}%;transition:width .3s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="font-size:11px;color:var(--txt3)">Buchung ${cur} von ${total}</div>
      <button class="btn btn-g" style="font-size:10px;padding:4px 10px" onclick="ReviewWorkflowModule._laterAction()">Später klären</button>
    </div>

    <!-- Buchungs-Details -->
    <div style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r12);padding:14px;margin-bottom:20px">
      <div style="font-size:28px;font-weight:200;letter-spacing:-1px;color:${isEingang?'var(--grn)':'var(--red)'};margin-bottom:4px">
        ${isEingang?'+':''}${BSP.fm(item.betrag)} €
      </div>
      <div style="font-size:13px;color:var(--txt);margin-bottom:4px">${BSP.eh(item.auftraggeber||'Unbekannt')}</div>
      <div style="font-size:11px;color:var(--txt3)">${BSP.fd(item.datum)} · ${BSP.eh(item.typ||'')}${item.isPrivatKonto?' · <span style="color:var(--orn)">Privatkonto</span>':''}</div>
      ${item.zweck ? `<div style="font-size:10px;color:var(--txt3);margin-top:6px;word-break:break-word">${BSP.eh(item.zweck)}</div>` : ''}
    </div>

    <!-- Frage 1: Business oder Privat -->
    <div id="rw-q1" style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Business oder Privat?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button style="padding:18px 8px;border:2px solid var(--accent);border-radius:var(--r12);background:rgba(200,164,90,.08);color:var(--accent);font-size:14px;font-weight:500;cursor:pointer"
          onclick="ReviewWorkflowModule._selectBP('business')">💼 Business</button>
        <button style="padding:18px 8px;border:2px solid var(--br2);border-radius:var(--r12);background:var(--bg3);color:var(--txt2);font-size:14px;cursor:pointer"
          onclick="ReviewWorkflowModule._selectBP('privat')">🏠 Privat</button>
      </div>
    </div>

    <!-- Frage 2: Kategorie (zunächst versteckt) -->
    <div id="rw-q2" style="display:none;margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Kategorie (SKR03)</div>
      ${suggestedCat ? `
      <button id="rw-cat-suggest" style="width:100%;padding:12px 14px;border:2px solid var(--accent);border-radius:var(--r12);background:rgba(200,164,90,.06);color:var(--txt);font-size:13px;text-align:left;cursor:pointer;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"
        onclick="ReviewWorkflowModule._selectCat('${BSP.eh(suggestedCat)}')">
        <span>⭐ ${BSP.eh(suggestedCat)}</span>
        <span style="font-size:10px;color:var(--txt3)">KI-Vorschlag · tippen zum Bestätigen</span>
      </button>` : ''}
      <select id="rw-cat-select" style="width:100%;padding:12px;background:var(--bg3);border:1px solid var(--br);border-radius:var(--r8);color:var(--txt);font-size:13px;margin-bottom:10px"
        onchange="ReviewWorkflowModule._selectCat(this.value)">
        <option value="">— Andere Kategorie wählen —</option>
        ${_skr03Keys.map(k => `<option value="${BSP.eh(k)}">${BSP.eh(k)}</option>`).join('')}
      </select>
    </div>

    <!-- Frage 3: Beleg verknüpfen (zunächst versteckt) -->
    <div id="rw-q3" style="display:none;margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Gibt es dafür einen Beleg?</div>
      ${matchedBelege.length > 0 ? matchedBelege.map(b => `
        <button style="width:100%;padding:10px 12px;border:1px solid var(--br);border-radius:var(--r8);background:var(--bg3);color:var(--txt);font-size:12px;text-align:left;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between"
          onclick="ReviewWorkflowModule._linkBeleg(${b.id})">
          <span>${BSP.eh(b.shop||b.empfaenger||'?')} · ${BSP.fm(b.brutto)} €</span>
          <span style="color:var(--txt3);font-size:10px">${BSP.fd(b.date)}</span>
        </button>`).join('') : ''}
      <button style="width:100%;padding:10px;border:1px dashed var(--br2);border-radius:var(--r8);background:transparent;color:var(--txt3);font-size:12px;cursor:pointer;margin-bottom:6px"
        onclick="ReviewWorkflowModule._linkBeleg(null)">Beleg fehlt noch</button>
    </div>

    <!-- Frage 4: Geldeingang ohne AR (zunächst versteckt) -->
    <div id="rw-q4" style="display:none;margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">⚠️ Geldeingang ohne Ausgangsrechnung</div>
      <div style="font-size:12px;color:var(--txt3);margin-bottom:12px">Wurde dafür eine Rechnung gestellt?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button style="padding:14px;border:2px solid var(--grn);border-radius:var(--r12);background:rgba(58,175,112,.08);color:var(--grn);font-size:13px;font-weight:500;cursor:pointer"
          onclick="ReviewWorkflowModule._createARFromIncome()">
          📄 Ja, jetzt erstellen
        </button>
        <button style="padding:14px;border:2px solid var(--red);border-radius:var(--r12);background:rgba(192,64,64,.06);color:var(--red);font-size:13px;cursor:pointer"
          onclick="ReviewWorkflowModule._markUncleared()">
          ✗ Nein, ungeklärt
        </button>
      </div>
    </div>

    <!-- Navigation -->
    <div style="display:flex;gap:8px;margin-top:8px">
      ${_cursor > 0 ? `<button class="btn btn-g" onclick="ReviewWorkflowModule._prev()" style="flex:1;justify-content:center">← Zurück</button>` : '<div style="flex:1"></div>'}
      <button class="btn btn-g" onclick="ReviewWorkflowModule._abort()" style="flex:1;justify-content:center">Abbrechen</button>
    </div>

    <div style="height:100px;flex-shrink:0"></div>
  `;

  BSP.showSheet(html);
}

// ── Frage 1: Business / Privat ────────────────────────────────
function _selectBP(choice) {
  const item = _queue[_cursor];
  if (!_changes[item.id]) _changes[item.id] = { ...item };
  _changes[item.id].businessPrivat = choice;

  if (choice === 'privat') {
    _changes[item.id].status = 'abgeschlossen';
    _advance();
    return;
  }
  // Business → Frage 2 einblenden
  document.getElementById('rw-q2').style.display = 'block';
}

// ── Frage 2: Kategorie ────────────────────────────────────────
function _selectCat(cat) {
  if (!cat) return;
  const item = _queue[_cursor];
  if (!_changes[item.id]) _changes[item.id] = { ...item };
  _changes[item.id].cat = cat;

  // Frage 3 einblenden
  document.getElementById('rw-q3').style.display = 'block';
  // Kategorie-Vorschlag-Button entfernen (Auswahl gemacht)
  const suggestBtn = document.getElementById('rw-cat-suggest');
  if (suggestBtn) suggestBtn.style.borderColor = 'var(--grn)';
}

// ── Frage 3: Beleg verknüpfen ─────────────────────────────────
function _linkBeleg(belegId) {
  const item = _queue[_cursor];
  if (!_changes[item.id]) _changes[item.id] = { ...item };

  if (belegId !== null) {
    _changes[item.id].belegId = belegId;
    _changes[item.id].status = 'abgeschlossen';
    _advance();
    return;
  }
  // Kein Beleg: ist es ein Geldeingang?
  if (item.betrag > 0 && _changes[item.id].businessPrivat === 'business') {
    document.getElementById('rw-q4').style.display = 'block';
  } else {
    _changes[item.id].status = 'abgeschlossen';
    _advance();
  }
}

// ── Frage 4: AR erstellen ─────────────────────────────────────
function _createARFromIncome() {
  const item = _queue[_cursor];
  // Workflow pausieren – AR-Sheet öffnet sich darüber
  _paused = true;
  _resumeCallback = (savedBeleg) => {
    if (!_changes[item.id]) _changes[item.id] = { ...item };
    _changes[item.id].belegId = savedBeleg.id;
    _changes[item.id].status = 'abgeschlossen';
    _advance();
    _renderStep();
  };
  // AR-Scanner als Sheet öffnen (Workflow bleibt im Hintergrund)
  BSP.closeSheet();
  if (typeof ScannerModule !== 'undefined') {
    setTimeout(() => {
      ScannerModule.openManuell('ar');
      BSP.toast('AR erstellen → dann kehrt der Workflow zurück', 'info');
    }, 350);
  }
}

// ── Geldeingang als ungeklärt markieren ───────────────────────
function _markUncleared() {
  const item = _queue[_cursor];
  if (!_changes[item.id]) _changes[item.id] = { ...item };
  _changes[item.id].status = 'offen';
  _changes[item.id].hasAlert = '⚠️ Geldeingang ohne AR – ungeklärt';
  _advance();
}

// ── Navigation ────────────────────────────────────────────────
function _prev() {
  if (_cursor > 0) { _cursor--; _renderStep(); }
}

function _skip() {
  _cursor++;
  _renderStep();
}

function _advance() {
  _cursor++;
  if (!_paused) _renderStep();
}

function _laterAction() {
  const item = _queue[_cursor];
  if (!_changes[item.id]) _changes[item.id] = { ...item };
  _changes[item.id].status = 'später_klären';
  _changes[item.id].ts = Date.now();
  _advance();
}

function _abort() {
  // Fortschritt speichern ohne abgeschlossen
  BSP.closeSheet();
  _batchSave(false);
}

// ── Abschluss ─────────────────────────────────────────────────
function _finishWorkflow() {
  BSP.closeSheet();
  _batchSave(true);
}

async function _batchSave(finished) {
  try {
    for (const [idStr, item] of Object.entries(_changes)) {
      if (item.id) {
        await BSP.prUpdate(item);
        // Konto-Store ebenfalls aktualisieren falls buchungsId vorhanden
        if (item.buchungsId) {
          try {
            const kontoItem = await BSP.dbGet('konto', item.buchungsId);
            if (kontoItem) {
              kontoItem.cat = item.cat || kontoItem.cat;
              kontoItem.businessPrivat = item.businessPrivat || kontoItem.businessPrivat;
              kontoItem.belegId = item.belegId || kontoItem.belegId;
              kontoItem.status = item.status === 'abgeschlossen' ? 'abgeglichen' : kontoItem.status;
              await BSP.dbPut('konto', kontoItem);
            }
          } catch(e) {}
        }
      }
    }
    await BSP.updatePendingBadge();
    const remaining = await BSP.prCountOpen();
    if (finished && remaining === 0) {
      BSP.toast('✓ Alle Buchungen geklärt – Export bereit!', 'ok');
      BSP.emit('review:completed');
    } else if (finished) {
      BSP.toast(`Noch ${remaining} offene Buchungen`, 'wr');
    } else {
      BSP.toast('Fortschritt gespeichert', 'ok');
    }
    BSP.emit('pending_review:changed');
  } catch(e) {
    BSP.toast('Speicherfehler: ' + e.message, 'er');
  }
}

// ── KI-Kategorie-Vorschlag (heuristisch, kein API) ───────────
function _suggestCategory(item) {
  const text = (item.zweck + ' ' + item.auftraggeber + ' ' + item.typ).toLowerCase();
  const rules = [
    ['amazon|amzn|otto|zalando', 'Bürobedarf'],
    ['paypal', 'Sonstige Betriebsausgaben'],
    ['google|microsoft|dropbox|notion|figma|github', 'Software & Cloud'],
    ['telekom|vodafone|o2|1\\.1|congstar', 'Telefon & Internet'],
    ['db |bahn|flug|air|ryanair|lufthansa', 'Reisekosten'],
    ['hotel|inn|hostel|airbnb', 'Reisekosten'],
    ['restaurant|pizza|sushi|mcdon|burger|liefern', 'Bewirtung'],
    ['tankstelle|shell|aral|esso|bp |total ', 'Fahrtkosten'],
    ['steuer|finanzamt|elster', 'Steuerberatung'],
    ['miete|büro|coworking|working', 'Raumkosten'],
    ['versicherung|allianz|axa|hdi|zürich', 'Versicherungen'],
    ['drucke|toner|papier|canon|epson', 'Bürobedarf'],
    ['werbung|meta|google ads|linkedin', 'Werbung & Marketing'],
    ['freiberuf|honorar|freelance', 'Fremdleistungen'],
  ];
  for (const [pattern, cat] of rules) {
    if (new RegExp(pattern).test(text)) return cat;
  }
  // Positive Beträge → Einnahme-Kategorie vorschlagen (AR)
  if (item.betrag > 0) return null; // Kein Vorschlag bei Eingang
  return null;
}

return { init, startFromPending, startWithItems, _selectBP, _selectCat, _linkBeleg, _createARFromIncome, _markUncleared, _prev, _abort, _laterAction };

})();

BSP.on('core:ready', () => ReviewWorkflowModule.init());
