# Broadsign HTML5 Package Lifecycle - Systematische Analyse

## Ziel
Verstehen des exakten Lifecycles von HTML5-Packages in Broadsign Control, um das Loading-Screen-Problem zu lösen.

## Dokumentations-Quellen
- https://docs.broadsign.com/broadsign-control/latest/html5.html

## Analyse-Status
- [ ] Package-Format und Upload
- [ ] Download und Deployment
- [ ] Rendering und Sichtbarkeit
- [ ] BroadSignPlay() Lifecycle
- [ ] Caching und Offline-Verhalten
- [ ] Timing und Performance
- [ ] Fehlerbehandlung

---

## Erkenntnisse

### Phase 1: Package-Format
- MIME Type: `application/x-html-package`
- Format: ZIP-Archiv mit HTML, JS, CSS, Assets
- Upload wie Videos, kann für Auktionen validiert werden

### Phase 2: Download und Deployment
- **KRITISCH**: "If the player does not have time to download and unzip the HTML5 package before the ad slot needs to play, the slot is skipped"
- Download und Entpacken muss VOR dem Slot fertig sein
- Chromium v87+ mit Security Patches bis v94

### Phase 3: Skip-Signal-Timing (WICHTIGSTE ERKENNTNIS!)
- **1 Sekunde**: "Once the HTML page is loaded, Splash Player performs a check after one second to read the content of the HTML document's `<title>` tag"
- **2 Sekunden Gesamt**: "In general, an HTML page has two seconds to load properly, otherwise the entire spot is skipped"
- Title-Werte: "ready", "skip", "skip:reason", "wait"
- Bei "wait": Weitere 1 Sekunde warten, dann erneute Prüfung (max 2 Sekunden total)

### Phase 4: BroadSignPlay() Lifecycle
- "BroadSignPlay() is called only when the HTML page is shown on screen"
- "allowing you to pre-buffer the content and control its starting time"
- Empfohlen für: Video Pre-Buffering, requestFocus() für Keyboard Input

### Phase 5: BroadSignObject
- Properties (keine Methoden!): `frame_id`, `display_unit_id`, `player_id`, `campaign_id`, etc.
- `expected_slot_duration_ms`, `impressions_per_hour`, `dwell_time_duration_ms`
- Automatisch injiziert in alle HTML5-Dateien

---

## Kritische Fragen
1. Wann genau wird die HTML-Seite geladen (DOM Ready)? → DOMContentLoaded ist der Trigger
2. Wann wird sie sichtbar gemacht? → Bei BroadSignPlay() - "at the same moment the Ad Copy is displayed"
3. Gibt es eine Off-Screen-Phase? → JA! Zwischen DOMContentLoaded und BroadSignPlay()
4. Wie viel Zeit ist zwischen verschiedenen Phasen? → Mindestens 1-2 Sekunden für Title-Check
5. Wie machen es andere SSPs? → (Noch zu untersuchen)

## BESTÄTIGTER Timeline-Ablauf (aus Dokumentation)

Quelle: [BroadSignPlay() Documentation](https://docs.broadsign.com/broadsign-control/15-8/broadsignplay.html)

**Wichtigster Fakt:**
> "Broadsign Control Player pre-buffers all ad copies **several seconds before** they are displayed by rendering them **off-screen**"

```
Package Download & Unzip (vor dem Slot, gecached)
        │
        ▼
[HTML Page Load OFF-SCREEN] ────────────► Nicht sichtbar!
        │
        ▼
DOMContentLoaded Event ──────────────────► Scripts starten
        │                                   Zeit für Pre-Loading!
        ▼                                   API + VAST + Media buffering
[Pre-Buffering Phase]                      "several seconds"
        │                                   Immer noch off-screen!
        ▼ (nach 1s)
Title Check ─────────────────────────────► "wait" → "ready" → "skip"
        │
        └─ "ready" ─────────────────────► Content markiert als bereit
                │
                ▼
        [Wartet auf Slot im Zeitplan]
                │
                ▼
    Ad Copy ist dran (kann Minuten später sein!)
                │
                ▼
    BroadSignPlay() called ─────────────► "just before display"
                │
                ▼
    Display startet ─────────────────────► JETZT ERST SICHTBAR!
```

## Kritische Erkenntnisse

1. **Off-Screen Phase existiert!**
   - "Pre-buffers all ad copies several seconds before"
   - Page wird off-screen gerendert

2. **BroadSignPlay() ist NICHT der Sichtbarkeits-Trigger**
   - "just before the HTML page is displayed"
   - Wird kurz vor Display aufgerufen, nicht beim Display

3. **"Several seconds" Pre-Buffer-Zeit**
   - Genug Zeit für API + VAST + Video-Loading
   - Aber: Keine exakte Zeitangabe!

4. **Zwei separate Konzepte:**
   - Skip-Signal (1-2s für "ready"): Entscheidet ob Slot eingeplant wird
   - Pre-Buffering (several seconds): Zeit für Content-Loading vor Display

---

## Fehlerhafte Annahmen (KORRIGIERT)
- [x] ~~Annahme: Page ist sichtbar bei DOMContentLoaded~~ → FALSCH: Page ist off-screen!
- [x] ~~Annahme: Keine Zeit für Pre-Loading~~ → FALSCH: "Several seconds" Pre-Buffer-Zeit!
- [x] ~~Annahme: BroadSignPlay() = Sichtbarkeit~~ → TEILWEISE FALSCH: "just before display"

## DAS EIGENTLICHE PROBLEM

### Symptom
Kunde sieht häufig den Loading Screen ("Loading Adlocaite..." mit Spinner)

### Root Cause Analysis

**Was passiert im Code:**

1. **HTML Initial State (index.html:14-17)**
   ```html
   <div class="loading-screen">
     <div class="loading-spinner"></div>
     <div class="loading-text">Loading Adlocaite...</div>
   </div>
   ```
   → Loading Screen ist HARDCODED im HTML!

2. **DOMContentLoaded (off-screen)**
   ```javascript
   await app.initialize();
   this.preloadPromise = this.preloadContent();
   ```
   → Pre-Loading startet, läuft im Hintergrund

3. **preloadContent() dauert 5-20 Sekunden**
   - API Request: 1-3s
   - VAST Parsing: <100ms
   - **preloadMedia() mit canplaythrough: 2-15s!**

4. **setPlaybackStatus('ready') wird gesetzt**
   → Aber Loading Screen ist noch da!

5. **BroadSignPlay() wird aufgerufen → Page wird SICHTBAR**
   → Loading Screen ist noch immer im DOM!

6. **start() wartet auf preloadPromise**
   ```javascript
   await this.preloadPromise;  // Schon fertig (hoffentlich)
   ```

7. **playPreloaded() entfernt Loading Screen**
   ```javascript
   this.containerElement.innerHTML = '';  // ← ERST HIER!
   ```

### Das Problem
**Loading Screen wird erst bei playPreloaded() entfernt, NICHT wenn setPlaybackStatus('ready') gesetzt wird!**

Wenn zwischen BroadSignPlay() (= Sichtbarkeit) und playPreloaded() auch nur 100ms liegen, sieht der Kunde den Loading Screen!

### Worst Case Szenario
1. Pre-Loading dauert länger als "several seconds" Pre-Buffer-Zeit
2. BroadSignPlay() wird aufgerufen während Pre-Loading noch läuft
3. Seite wird sichtbar mit Loading Screen
4. start() wartet auf preloadPromise (1-10 Sekunden!)
5. Kunde sieht 1-10 Sekunden Loading Screen
6. Erst dann playPreloaded() und Content-Display

---

## LÖSUNG

### Warum funktioniert es bei anderen SSPs?

Andere SSPs machen vermutlich eines oder mehrere der folgenden Dinge:

1. **Schnelleres Pre-Loading**
   - Nutzen loadedmetadata statt canplaythrough
   - Starten Video sofort, auch wenn nicht vollständig gepuffert
   - Kürzere Timeouts

2. **Kein sichtbarer Loading Screen**
   - Schwarzer Hintergrund standardmäßig
   - Kein Spinner im HTML
   - Content erscheint einfach

3. **Aggressiveres Skip-Signal**
   - Bei Timeouts wird sofort "skip" gesetzt
   - Kein langes Warten auf Pre-Loading

### Empfohlene Fixes

#### **Fix 1: Loading Screen ausblenden bei erfolgreiche Pre-Load (RECOMMENDED)**
```javascript
// In preloadContent(), nach erfolgreicher Media-Pre-Load:
console.log('[Adlocaite] Pre-load complete. Ready for instant playback.');

// ← NEU: Loading Screen verstecken!
const loadingScreen = document.querySelector('.loading-screen');
if (loadingScreen) {
  loadingScreen.style.display = 'none';
}

this.setPlaybackStatus('ready');
return this.preloadedContent;
```

#### **Fix 2: Loading Screen aus HTML entfernen**
```html
<!-- Statt Loading Screen hardcoded: -->
<div id="adlocaite-container" class="adlocaite-container">
  <!-- Einfach schwarz, kein Spinner -->
</div>
```

#### **Fix 3: Timeout für Pre-Loading**
```javascript
// In preloadContent():
const PRELOAD_TIMEOUT = 8000; // Max 8s für Pre-Load

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Pre-load timeout')), PRELOAD_TIMEOUT)
);

try {
  await Promise.race([
    this.player.preloadMedia(mediaFile),
    timeoutPromise
  ]);
} catch (err) {
  // Timeout → Skip
  this.setPlaybackStatus('skip', 'preload timeout');
  return { error: true };
}
```

#### **Fix 4: loadedmetadata statt canplaythrough**
```javascript
// In player.js preloadVideo():
// Statt: await canplaythrough Event
// Nutze: await loadedmetadata Event

const onLoadedMetadata = () => {
  cleanup();
  this.duration = this.preloadedVideoElement.duration;
  this.log(`Video pre-loaded. Duration: ${this.duration}s`);
  resolve();
};

this.preloadedVideoElement.addEventListener('loadedmetadata', onLoadedMetadata);
```

### Kombinierte Strategie (BESTE LÖSUNG)
1. Loading Screen aus HTML entfernen (schwarzer Hintergrund)
2. loadedmetadata statt canplaythrough (schnelleres Pre-Loading)
3. Timeout von 20s auf 5s reduzieren
4. Bei Timeout: skip statt warten
