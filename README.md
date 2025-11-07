# Adlocaite Broadsign Integration

HTML5-Package für Broadsign Control Player zur Integration programmatischer DOOH-Anzeigen über die Adlocaite API.

## Übersicht

Dieses HTML5-Package ermöglicht es Broadsign Control Playern, programmatische Werbeanzeigen von Adlocaite anzufordern, abzuspielen und das Playout zu bestätigen. Die Integration unterstützt VAST-basierte Medien-Auslieferung mit automatischem Tracking.

## Features

- ✅ VAST 4.0 Support mit automatischem Event-Tracking
- ✅ Video und Image Playout
- ✅ Broadsign JavaScript API Integration (`BroadSignObject`)
- ✅ Automatische Screen-Identifikation
- ✅ Optional: Asset Pre-Caching für Offline-Betrieb
- ✅ Fallback-Mechanismus bei fehlenden Offers
- ✅ Vollständiges Error Handling
- ✅ Debug-Modus für Entwicklung

## Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd adlocaite-broadsign
```

### 2. Konfiguration erstellen

Kopiere die Beispiel-Konfiguration und füge deinen API-Key hinzu:

```bash
cp package/js/config.example.js package/js/config.js
```

Öffne `package/js/config.js` und trage deine Konfiguration ein:

```javascript
const ADLOCAITE_CONFIG = {
  apiKey: 'pub_xxxx',  // Dein Publisher API Key
  apiBaseUrl: 'https://staging.api.adlocaite.com/functions/v1/api',
  minBidCents: 100,
  enableCaching: true,
  cachingInterval: 300000, // 5 Minuten
  vastMode: true,
  fallbackEnabled: true,
  debugMode: false
};
```

### 3. Package erstellen

```bash
npm run package
```

Dies erstellt `adlocaite-broadsign.x-html-package` im Hauptverzeichnis.

### 4. In Broadsign hochladen

1. Öffne Broadsign Control Administrator
2. Navigiere zu **Library > Ad Copies**
3. Klicke auf **Upload**
4. Wähle `adlocaite-broadsign.x-html-package`
5. Weise das Ad Copy einer Campaign zu

## Konfiguration

### API-Key Management

**Wichtig**: Der API-Key in `config.js` ist sensibel und wird nicht ins Git-Repository committed.

- **Production**: `https://api.adlocaite.com/functions/v1/api`
- **Staging**: `https://staging.api.adlocaite.com/functions/v1/api`

### Konfigurationsoptionen

| Option | Typ | Default | Beschreibung |
|--------|-----|---------|-------------|
| `apiKey` | string | - | Publisher API Key (erforderlich) |
| `apiBaseUrl` | string | staging | API Basis-URL |
| `minBidCents` | number | 100 | Minimaler Gebotspreis in Cent |
| `enableCaching` | boolean | true | Asset Pre-Caching aktivieren |
| `cachingInterval` | number | 300000 | Cache-Aktualisierungsintervall (ms) |
| `vastMode` | boolean | true | VAST XML anfordern |
| `fallbackEnabled` | boolean | true | Fallback-Bild bei fehlenden Offers |
| `debugMode` | boolean | false | Debug-Logging aktivieren |

## Verwendung

### Screen-Identifikation

Das Package nutzt `BroadSignObject.getScreenId()` zur automatischen Screen-Identifikation. Stelle sicher, dass deine Screens in Adlocaite registriert sind.

### Workflow

1. **Initialisierung**: Broadsign startet das HTML5-Package
2. **Screen-ID abrufen**: Via Broadsign JavaScript API
3. **Offer Request**: API-Anfrage mit `vast=true`
4. **VAST Parsing**: MediaFile und Tracking-URLs extrahieren
5. **Playout**: Video/Image abspielen mit Event-Tracking
6. **Confirmation**: Automatische Playout-Bestätigung

### Testing

#### Demo-Modus

Teste die Integration ohne echte Offers:

```javascript
// In config.js
const ADLOCAITE_CONFIG = {
  // ...
  debugMode: true
};
```

#### Test-Deal

Verwende den Test-Deal für Playout-Tests:
- Deal-ID: `test-deal-test`

## Deployment

### Production Checklist

- [ ] API-Key korrekt konfiguriert
- [ ] `apiBaseUrl` auf Production-URL gesetzt
- [ ] `debugMode: false` gesetzt
- [ ] Package neu erstellt mit `npm run package`
- [ ] In Broadsign hochgeladen und getestet

### Monitoring

Das Package loggt alle wichtigen Events in die Browser-Console (erreichbar in Broadsign Player Logs):

```
[Adlocaite] Screen ID: abc-123
[Adlocaite] Requesting offer...
[Adlocaite] Offer received: offer_xyz
[Adlocaite] VAST parsed successfully
[Adlocaite] Playing video: https://...
[Adlocaite] Playout confirmed: playout_123
```

## Troubleshooting

### Problem: Keine Offers erhalten (404)

**Lösung:**
- Prüfe, ob die Screen-ID in Adlocaite registriert ist
- Kontrolliere `minBidCents` - evtl. zu hoch gesetzt
- Checke API-Key Berechtigung

### Problem: API-Authentifizierung fehlgeschlagen (401)

**Lösung:**
- API-Key in `config.js` überprüfen
- Sicherstellen, dass Key mit `pub_` beginnt
- Key-Gültigkeit beim Adlocaite-Support prüfen

### Problem: Medien werden nicht geladen

**Lösung:**
- Netzwerk-Zugriff des Players prüfen
- CORS-Einstellungen überprüfen
- Asset-URL in Browser-Console checken
- Chromium-Cache löschen

### Problem: VAST Parse-Fehler

**Lösung:**
- Debug-Modus aktivieren: `debugMode: true`
- VAST XML in Console prüfen
- VAST Validator verwenden: https://googleads.github.io/googleads-ima-html5/vast_inspector/

### Problem: BroadSignObject nicht verfügbar

**Lösung:**
- Sicherstellen, dass Package als Broadsign Ad Copy läuft
- Nicht im Browser-Preview testen - nur im echten Player
- `BroadSignPlay()` Funktion muss vom Player aufgerufen werden

## API-Referenz

### Adlocaite API Endpoints

- `GET /offers/request/{screenId}` - Offer anfordern
- `POST /offers/response/{offerId}` - Offer akzeptieren/ablehnen
- `POST /playout/confirm/{dealId}` - Playout bestätigen
- `GET /screens/{screenId}/cacheable-assets` - Cacheable Assets abrufen

Vollständige API-Dokumentation: https://docs.adlocaite.com

## Architektur

```
┌─────────────────────────────────────┐
│   Broadsign Control Player          │
│   (Chromium Browser)                 │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  HTML5 Package                 │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │  Broadsign Adapter       │  │ │
│  │  │  (BroadSignPlay)         │  │ │
│  │  └──────────────────────────┘  │ │
│  │           ↓                     │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │  Adlocaite API Client    │  │ │
│  │  └──────────────────────────┘  │ │
│  │           ↓                     │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │  VAST Parser             │  │ │
│  │  └──────────────────────────┘  │ │
│  │           ↓                     │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │  Media Player            │  │ │
│  │  └──────────────────────────┘  │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓
    ┌─────────────────────┐
    │  Adlocaite API      │
    │  (REST/VAST)        │
    └─────────────────────┘
```

## Support

Bei Fragen oder Problemen:

- **Adlocaite Support**: support@adlocaite.com
- **Dokumentation**: https://docs.adlocaite.com
- **API Status**: https://status.adlocaite.com

## Lizenz

MIT License - siehe LICENSE Datei

## Changelog

### Version 1.0.0 (2025-11-05)

- Initial Release
- VAST 4.0 Support
- Broadsign Control Integration
- Asset Pre-Caching
- Debug-Modus


