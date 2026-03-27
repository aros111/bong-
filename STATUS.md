# Projekt-Status: BelegScan Pro

## Was heute fertiggestellt wurde
* **Kontoauszug-Scanner (`konto.js`)**: Ein vollwertiger, autarker Scanner zum Einlesen von Kontoauszügen inklusive KI-Extraktion (Datum, Empfänger, Betrag, Buchungstypen) und einem Fuzzy-Matching-Algorithmus zum automatisierten Abgleich mit gebuchten Belegen.
* **Abo-Manager (`abo.js`)**: Eine automatische Erkennungs-Engine für Daueraufträge. Features umfassen manuelle Zuweisungen (Business / Privat prozentual gesplittet) und Prioritätensetzung (Unverzichtbar bis Zu kündigen). 
* **Übergangs-Modus (`einstellungen.js`)**: Ein Toggle zur Interception von neuen (ungeklärten) Kontobuchungen. Nutzer müssen Konto-Herkunft (Business vs. Privatkonto) und den Ausgabentyp manuell zuweisen. Mismatches (z. B. privater Einkauf via Firmenkonto) werden geloggt.
* **DATEV-Export Optimierung (`export.js`)**: Erweiterung des ZIP-Exports um dedizierte Tabellen. Der Export teilt sich nun in `buchungen.csv`, `konto-buchungen.csv` (Gesamtledger), `geldeingaenge.csv` (strikt gefiltert) und `konto-korrekturen.csv` auf. Template-Literal-Syntaxfehler im Export wurden sicher bereinigt.
* **Service Worker Update (`sw.js`)**: Cache Version auf v3.8.0 hochgestuft und Push vorbereitet.
* **UI Anpassung**: Die neuen Funktionen (`konto` und `abos`) wurden in das Menü (`einstellungen.js`) und als Schnellwahlpunkte (Post-Its vor "Fahrten") im Haupt-Dashboard (Business) aufgenommen.

## Was als nächstes ansteht
* **Kündigungs-Gepard (`archiv-antwort.js`)**: Der Workflow zur automatischen Generierung von Kündigungsschreiben aus dem Abo-Modul heraus muss vollumfänglich verknüpft und getestet werden.
* **FinTS / Online Banking Integration**: Die in der Datenbank vorbereiteten Felder (`iban`, `fints_url` etc.) sollen produktiv genutzt werden, um Transaktionen direkt via Bank-API abzurufen, statt sie vom Papierauszug einscannen zu müssen.

## Welche offenen Entscheidungen noch ausstehen
* Wie stark die App weiterhin auf "Offline-Scanner" fokussiert bleiben soll im Vergleich zur direkten FinTS/HBCI Schnittstelle (Online-Pflicht).
* Ob der Kündigungs-Gepard generierte PDFs auch direkt per E-Mail aus der App versenden darf (Mail-API/Mailto-Wrapper) oder ob der User dies weiterhin manuell (Download -> Senden) übernehmen soll.

## Bekannte Bugs oder offene Punkte
* **IndexDB Bereinigung / Löschen APIs**: Das Löschen von Abo-Einträgen funktioniert derzeit als Soft-Delete, weil die `BSP.dbDelete()` Implementierung teils im Core fehlt. (Abo wird durch `betrag = 0` und `deleted = true` logisch genullt statt physisch gelöscht).
* **`konto-buchungen.csv` Offline-Status**: Offline erstellte Transaktions-Verknüpfungen referenzieren die Blob-IDs, welche korrekt aus der db ausgelesen werden müssen.
