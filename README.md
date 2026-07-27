# Zaster Master

Persönliche Finanz-App für Windows. Daten bleiben **lokal** auf deinem PC.

## Brauchst du

1. <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer">Docker Desktop</a> — installieren und **starten**
2. <a href="https://git-scm.com/download/win" target="_blank" rel="noopener noreferrer">Git</a>

## Einrichten

```bash
git clone <URL-DES-REPOS>
cd zastermaster
```

1. **`setup-hosts.bat`** als Administrator ausführen (einmalig)
2. **`start.bat`** starten (erster Build kann einige Minuten dauern)
3. Öffnen: <a href="http://zastermaster" target="_blank" rel="noopener noreferrer">http://zastermaster</a> — Fallback: <a href="http://127.0.0.1:3080" target="_blank" rel="noopener noreferrer">http://127.0.0.1:3080</a>

| Aktion | Datei |
|---|---|
| Starten | `start.bat` |
| Stoppen | `stop.bat` |
| Update | `update.bat` |
| Backup | `backup.bat` → `backups\` |

Keine Bank-Exporte oder `.env.ship` committen/teilen.

## Updates (neue Versionen)

Wenn im Git-Repo neue Änderungen liegen:

1. Docker Desktop starten
2. **`update.bat`** ausführen

Das Skript pulled automatisch den neuen Code und baut die Images + Stack neu. Die Datenbank (Docker-Volume) bleibt dabei erhalten. Nur bei sehr großen Änderungen kann der Rebuild länger dauern.

## Entwickler

Produkt-Doku: [`ai/README.md`](ai/README.md) · Shipping: [`ai/docs/shipping-plan.md`](ai/docs/shipping-plan.md)
