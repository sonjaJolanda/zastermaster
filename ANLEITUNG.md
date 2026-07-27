# Zaster Master — Einrichtung (Windows)

Nur **Setup**: Installieren, starten, updaten, Backup.  
Keine Erklärung der App-Funktionen (Transaktionen, Analyse, …).

Daten bleiben **lokal** auf deinem PC. Der Code darf aus einem öffentlichen Git-Repo kommen.

---

## Was du brauchst

1. **Docker Desktop** für Windows — installieren und **starten** (Wal-Icon in der Taskleiste).  
   https://www.docker.com/products/docker-desktop/
2. **Git** für Windows — https://git-scm.com/download/win  
3. Internet für den ersten Download/Build

---

## Einmalig einrichten

### 1. Repo holen

Im Explorer einen Ordner wählen, dann in Git Bash oder PowerShell:

```bash
git clone <URL-DES-REPOS>
cd zastermaster
```

### 2. Freundliche Adresse `zastermaster`

Rechtsklick auf **`setup-hosts.bat`** → **Als Administrator ausführen**.  
Danach zeigt Windows den Namen `zastermaster` auf deinen PC (`127.0.0.1`).

### 3. App starten

Doppelklick auf **`start.bat`**.

- Beim **ersten Mal** kann der Build **viele Minuten** dauern (Docker lädt und baut die App).
- Es wird automatisch `.env.ship` angelegt (lokale Einstellungen, nicht fürs Internet).
- Der Browser öffnet idealerweise **http://zastermaster**

**Falls die Seite nicht lädt:**

| Versuch | URL |
|---|---|
| Normal | http://zastermaster |
| Port 80 belegt | http://127.0.0.1:3080 |
| API-Check | http://zastermaster:3002 (oder http://127.0.0.1:3002) |

Stelle sicher, dass Docker Desktop wirklich läuft.

---

## Täglich / später

| Aktion | Datei |
|---|---|
| Starten | `start.bat` |
| Stoppen | `stop.bat` |
| Neueste Version holen | `update.bat` (`git pull` + neu bauen) |
| Datenbank sichern | `backup.bat` → Ordner `backups\` |

---

## Wichtig für Datenschutz

- Keine Bank-Exporte ins Git legen (`Bankauszüge/` ist absichtlich ignoriert).
- `.env.ship` nicht teilen oder committen.
- Die App lauscht nur auf **localhost** (`127.0.0.1`) — nicht absichtlich im Internet erreichbar.
- Backups (`backups\*.sql`) enthalten deine Daten — sicher aufbewahren.

---

## Probleme

**„Docker wurde nicht gefunden“**  
Docker Desktop installieren/starten, PC ggf. neu starten.

**„Port is already allocated“ / Seite auf Port 80 geht nicht**  
Etwas anderes nutzt Port 80. Nutze http://127.0.0.1:3080 oder beende das andere Programm.

**`zastermaster` wird nicht gefunden**  
`setup-hosts.bat` erneut als Administrator ausführen.

**Update schlägt fehl**  
`git status` prüfen (eigene Änderungen?). Bei Bedarf Maintainer fragen.

**Build-Fehler**  
Log in Docker Desktop → Container/Build ansehen und Maintainer die Meldung schicken.

---

## Was im Docker läuft

Mit `start.bat` startet ein **kompletter** Stack in Docker Desktop:

- PostgreSQL (eigene Datenbank-Volume)
- Server (Node / Wasp — Build und Dependencies **im Image**)
- Client (fertige statische Web-App)

Auf dem PC brauchst du dafür **kein** WSL, kein Node und kein Wasp — nur Docker Desktop und Git.

---

## Für Entwickler (Ship parallel zur Dev-Umgebung)

Ship und Dev sind **getrennte** Compose-Projekte und Volumes — deine Dev-DB (`zastermaster_pgdata` / Port `5432`) bleibt unberührt.

| | Dev | Ship |
|---|---|---|
| Start | `docker compose up -d db` + `wasp start` (WSL) | `start.bat` |
| Compose | `docker-compose.yml` | `docker-compose.ship.yml` |
| Daten | Volume `zastermaster_pgdata` | Volume `zastermaster_ship_pgdata` |

**Vor dem Ausprobieren von Ship:** nichts Spezielles nötig — Ship-API liegt auf Port **3002**, Dev/`wasp start` weiter auf **3001**. Bei Bedarf `stop.bat`, dann wieder normal entwickeln.

Details: [`ai/docs/shipping-plan.md`](ai/docs/shipping-plan.md).
