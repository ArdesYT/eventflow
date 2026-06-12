# EventFlow

Konferencia- és eseményprogram-kezelő: előadások, termek, előadók, látogatói mentett program.

## Funkciók

- **Admin** — felhasználók, audit napló, esemény profil, demo seed
- **Szervező (booker)** — foglalás, ütközésellenőrzés, tömeges módosítás, termek szerinti jogosultság
- **Látogató** — program böngészés, mentett program, ICS export, értesítések

## Gyors indítás (fejlesztés)

```bash
npm install
cp .env.example .env
# Indíts MariaDB-t, importáld: src/backend/eventflow.sql
npm run seed
npm run server   # API :3000
npm run dev      # Frontend :5173
```

Demó fiókok: `admin@example.com` / `admin123`, `booker@example.com` / `booker123`, `attendee@example.com` / `attendee123`

## Production (Docker)

```bash
cp .env.example .env
# Állítsd be: JWT_SECRET=hosszú-véletlen-string
docker compose up --build -d
```

Alkalmazás: http://localhost:3000  
Health check: http://localhost:3000/api/health

Első telepítés után jelentkezz be adminként, és futtasd a **Demo adatok betöltése** gombot, vagy: `docker compose exec app npm run seed`

## Production (kézi)

```bash
npm ci
npm run build
export NODE_ENV=production
export JWT_SECRET=your-secret
npm run start
```

A buildelt frontend a `dist/` mappából szolgálódik ki ugyanazon a porton.

## Környezeti változók

| Változó | Kötelező (prod) | Leírás |
|---------|-----------------|--------|
| `JWT_SECRET` | Igen | JWT aláíró kulcs |
| `DB_*` | Igen | MariaDB kapcsolat |
| `CLIENT_URL` | Ajánlott | CORS origin |
| `PORT` | Nem | Alapértelmezett: 3000 |

## API

| Endpoint | Leírás |
|----------|--------|
| `GET /api/health` | Állapot + DB |
| `GET /api/event` | Aktív esemény profil |
| `GET /api/rooms` | Termek listája |
| `GET /api/sessions` | Program |

## Tesztek

```bash
npm test
```

## Biztonság

- Bejelentkezés rate limit (20 kérés / 15 perc / IP)
- Szerveroldali terem- és előadó-ütközés ellenőrzés
- Production módban kötelező `JWT_SECRET`

## Licenc

ISC
