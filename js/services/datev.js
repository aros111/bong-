'use strict';

(() => {
  const SKR03 = {
    // Einkauf - Automatik-Konten
    'Hardware und Geräte':                   { konto: 3030, automatik: true },
    'Einkauf 7% Vorsteuer':                  { konto: 3010, automatik: true },
    'Fremdleistungen':                       { konto: 3100, steuer: 0 },
    'Fremdleistungen 19%':                   { konto: 3106, steuer: 1 },
    
    // Raumkosten
    'Raumkosten allgemein':                  { konto: 4200, steuer: 0 },
    'Miete Büro oder Arbeitszimmer':         { konto: 4210, steuer: 0 },
    'Reinigung':                             { konto: 4250, steuer: 0 },
    
    // Fahrzeug
    'Fahrzeug-Versicherungen':               { konto: 4520, steuer: 0 },
    'Fahrtkosten Km-Pauschale':              { konto: 4530, steuer: 0 },
    'Fahrzeug-Reparaturen':                  { konto: 4540, steuer: 0 },
    'Sonstige Fahrzeugkosten':               { konto: 4580, steuer: 0 },
    'Abschreibungen Fahrzeuge':              { konto: 4832, steuer: 0 },
    
    // Reisekosten
    'Fahrt- und Flugkosten':                 { konto: 4673, steuer: 0 },
    'Verpflegungspauschale':                 { konto: 4674, steuer: 0 },
    'Übernachtungskosten':                   { konto: 4676, steuer: 0 },
    
    // Bewirtung
    'Bewirtung 70% absetzbar':               { konto: 4650, steuer: 0 },
    'Bewirtung 30% nicht absetzbar':         { konto: 4654, steuer: 0 },
    
    // Fortbildung
    'Fortbildung und Seminare':              { konto: 4945, steuer: 0 },
    
    // Marketing
    'Marketing und Werbung':                 { konto: 4600, steuer: 0 },
    'Aufmerksamkeiten':                      { konto: 4653, steuer: 0 },
    'Verkaufsprovisionen':                   { konto: 4760, steuer: 0 },
    
    // Büro und Betrieb
    'Reparaturen und Instandhaltung':        { konto: 4809, steuer: 0 },
    'Telefon':                               { konto: 4920, steuer: 0 },
    'Internetkosten':                        { konto: 4925, steuer: 0 },
    'Büromaterial und Druckkosten':          { konto: 4930, steuer: 1 },
    'Buchführungskosten':                    { konto: 4955, steuer: 0 },
    'Abschluss- und Prüfungskosten':         { konto: 4957, steuer: 0 },
    'Software und Lizenzen':                 { konto: 4964, steuer: 1 },
    'Sonstiger Betriebsbedarf':              { konto: 4980, steuer: 0 },
    'Werkzeuge und Kleingeräte':             { konto: 4985, steuer: 1 },
    
    // Reverse Charge
    'Reverse Charge sonstige Leistung':      { konto: 3100, steuerSchluessel: 94 },
    'Reverse Charge Lieferung':              { konto: 3030, steuerSchluessel: 19, automatik: true },
    
    // Einnahmen
    'Honorar 19%':                           { konto: 8400, steuer: 1 },
    'Erlöse 7%':                             { konto: 8300, steuer: 2 },
    'EU-Erlöse §18b':                        { konto: 8336, steuer: 0 },
    'Drittland-Erlöse':                      { konto: 8338, steuer: 0 }
  };

  BSP.DATEV = {
    SKR03
  };

  console.log('[BSP] datev.js injected.');
})();
