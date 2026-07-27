# Zaster Master

Persönliche Finanz-App für Windows. Daten bleiben **lokal** auf deinem PC.

## Brauchst du

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) — installieren und **starten**
2. [Git](https://git-scm.com/download/win)

## Einrichten

```bash
git clone <URL-DES-REPOS>
cd zastermaster
```

1. **`setup-hosts.bat`** als Administrator ausführen (einmalig)
2. **`start.bat`** starten (erster Build kann einige Minuten dauern)
3. Öffnen: **http://zastermaster** — Fallback: http://127.0.0.1:3080

| Aktion | Datei |
|---|---|
| Starten | `start.bat` |
| Stoppen | `stop.bat` |
| Update | `update.bat` |
| Backup | `backup.bat` → `backups\` |

Keine Bank-Exporte oder `.env.ship` committen/teilen.

## Entwickler

Produkt-Doku: [`ai/README.md`](ai/README.md) · Shipping: [`ai/docs/shipping-plan.md`](ai/docs/shipping-plan.md)
