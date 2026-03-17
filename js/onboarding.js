// ══════════════════════════════════════════════════════════════
// MODUL: ONBOARDING
// Pflicht-Setup beim ersten Start (8 Schritte)
// ══════════════════════════════════════════════════════════════
'use strict';

const OnboardingModule = (() => {

  const VIEW_HTML = `
  <div id="onboarding" class="onboarding-overlay">
    <div class="ob-box">
      <div class="ob-progress"><div id="ob-bar" style="width:12.5%"></div></div>
      
      <!-- STEP 1: Land -->
      <div class="ob-step on" data-step="1">
        <h2>Willkommen 👋</h2>
        <p>Wo bist du steuerpflichtig?</p>
        <div class="ob-grid">
          <button class="ob-choice on" onclick="OnboardingModule.set('land','de',this)">🇩🇪 Deutschland</button>
          <button class="ob-choice" onclick="OnboardingModule.set('land','at',this)">🇦🇹 Österreich</button>
          <button class="ob-choice" onclick="OnboardingModule.set('land','ch',this)">🇨🇭 Schweiz</button>
        </div>
      </div>

      <!-- STEP 2: Name & Steuern -->
      <div class="ob-step" data-step="2">
        <h2>Wer bist du? 👤</h2>
        <div class="field"><label>Vorname</label><input id="ob_vorname" type="text" placeholder="Max"></div>
        <div class="field"><label>Nachname</label><input id="ob_nachname" type="text" placeholder="Mustermann"></div>
        <div class="sett-grid">
          <div class="field"><label>Steuernummer</label><input id="ob_steuernr" type="text" placeholder="123/456/7890"></div>
          <div class="field"><label>USt-IdNr.</label><input id="ob_ustidnr" type="text" placeholder="DE123456789"></div>
        </div>
      </div>

      <!-- STEP 3: Ort -->
      <div class="ob-step" data-step="3">
        <h2>Wo arbeitest du? 🏢</h2>
        <div class="field"><label>Betriebsstätte (Anschrift)</label><input id="ob_adresse" type="text" placeholder="Musterstr. 1, 10115 Berlin"></div>
        <div class="field"><label>Heimatort (für km-Geld)</label><input id="ob_heimat" type="text" placeholder="Berlin-Zentrum"></div>
      </div>

      <!-- STEP 4: Familie -->
      <div class="ob-step" data-step="4">
        <h2>Familienstand 🏠</h2>
        <div class="sett-grid">
          <div class="field"><label>Status</label>
            <select id="ob_familienstand">
              <option value="ledig">Ledig</option>
              <option value="verheiratet">Verheiratet</option>
              <option value="geschieden">Geschieden</option>
            </select></div>
          <div class="field"><label>Steuerklasse</label>
            <select id="ob_stklasse">
              <option value="1">Klasse I</option>
              <option value="3">Klasse III</option>
              <option value="4">Klasse IV</option>
            </select></div>
        </div>
        <div class="field"><label>Anzahl Kinder</label><input id="ob_kinder" type="number" value="0"></div>
      </div>

      <!-- STEP 5: Finanzen -->
      <div class="ob-step" data-step="5">
        <h2>Stundensätze 💰</h2>
        <div class="field"><label>Dein Stundensatz (€/h)</label><input id="ob_stundensatz" type="number" value="80"></div>
        <div class="field"><label>StB Stundensatz (€/h)</label><input id="ob_stbSatz" type="number" value="120"></div>
      </div>

      <!-- STEP 6: API & PIN -->
      <div class="ob-step" data-step="6">
        <h2>Sicherheit 🔐</h2>
        <div class="field"><label>Anthropic API Key (optional)</label>
          <input id="ob_apikey" type="password" placeholder="sk-ant-..."></div>
        <div class="field"><label>Verschlüsselungs-PIN (4 Stellen)</label>
          <input id="ob_pin" type="password" maxlength="4" placeholder="0000" inputmode="numeric"></div>
      </div>

      <!-- STEP 7: Format -->
      <div class="ob-step" data-step="7">
        <h2>Belegnummern 🔢</h2>
        <p>Wähle dein bevorzugtes Format:</p>
        <div class="ob-grid">
          <button class="ob-choice on" onclick="OnboardingModule.set('fmt','A',this)">ER-2026-0001</button>
          <button class="ob-choice" onclick="OnboardingModule.set('fmt','B',this)">2026-Q1-ER-001</button>
        </div>
      </div>

      <!-- STEP 8: Erstes Konto -->
      <div class="ob-step" data-step="8">
        <h2>Erstes Konto 🏦</h2>
        <div class="field"><label>Name der Bank</label><input id="ob_bank" type="text" placeholder="Sparkasse / Revolut"></div>
        <div class="field"><label>Typ</label>
          <select id="ob_kontoTyp">
            <option value="business">Geschäftskonto</option>
            <option value="privat">Privatkonto</option>
          </select></div>
      </div>

      <div class="ob-nav">
        <button id="ob-back" class="btn btn-g" onclick="OnboardingModule.prev()" style="display:none">Zurück</button>
        <button id="ob-next" class="btn btn-gold" onclick="OnboardingModule.next()">Weiter →</button>
      </div>
    </div>
  </div>
  `;

  let _currentStep = 1;
  const _data = { land: 'de', fmt: 'A' };

  function init() {
    if (BSP.state.settings && BSP.state.settings.setupDone) return;
    
    // HTML einfügen
    document.body.insertAdjacentHTML('beforeend', VIEW_HTML);
  }

  function set(key, val, el) {
    _data[key] = val;
    // UI Feedback
    el.parentElement.querySelectorAll('.ob-choice').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
  }

  function next() {
    if (_currentStep === 8) return _finish();
    
    _currentStep++;
    _updateUI();
  }

  function prev() {
    if (_currentStep === 1) return;
    _currentStep--;
    _updateUI();
  }

  function _updateUI() {
    document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('on'));
    document.querySelector(`.ob-step[data-step="${_currentStep}"]`).classList.add('on');
    
    const bar = document.getElementById('ob-bar');
    if (bar) bar.style.width = (_currentStep / 8 * 100) + '%';

    document.getElementById('ob-back').style.display = _currentStep === 1 ? 'none' : 'block';
    document.getElementById('ob-next').textContent = _currentStep === 8 ? 'Loslegen ✓' : 'Weiter →';
  }

  async function _finish() {
    // Daten sammeln
    const final = {
      ..._data,
      vorname: document.getElementById('ob_vorname').value,
      nachname: document.getElementById('ob_nachname').value,
      steuernr: document.getElementById('ob_steuernr').value,
      ustidnr: document.getElementById('ob_ustidnr').value,
      adresse: document.getElementById('ob_adresse').value,
      heimat: document.getElementById('ob_heimat').value,
      familienstand: document.getElementById('ob_familienstand').value,
      stklasse: document.getElementById('ob_stklasse').value,
      kinder: parseInt(document.getElementById('ob_kinder').value) || 0,
      stundensatz: parseFloat(document.getElementById('ob_stundensatz').value) || 80,
      stbSatz: parseFloat(document.getElementById('ob_stbSatz').value) || 120,
      pin: document.getElementById('ob_pin').value || '0000',
      belegFmt: _data.fmt,
      setupDone: '1',
      _apiKey: document.getElementById('ob_apikey').value
    };

    if (!final.vorname || !final.steuernr) {
      return BSP.toast('Bitte fülle alle Pflichtfelder aus (Name & Steuernr.)', 'wr');
    }

    // Erstes Konto anlegen
    const bank = document.getElementById('ob_bank').value;
    const type = document.getElementById('ob_kontoTyp').value;
    if (bank) {
      await BSP.dbAdd('einstellungen', { key: 'bank_initial', name: bank, type });
    }

    await BSP.saveAllSettings(final);
    
    // UI entfernen
    const ob = document.getElementById('onboarding');
    ob.classList.add('fade-out');
    setTimeout(() => {
      ob.remove();
      BSP.emit('onboarding:complete');
    }, 500);
  }

  return { init, set, next, prev };

})();
