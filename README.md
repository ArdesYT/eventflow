# EventFlow

Konferencia- és eseményprogram-kezelő webalkalmazás: előadások ütemezése, látogatói program, adminisztráció.

**Verzió:** 1.0.0  
**Stack:** React (Vite) · Express · MariaDB · JWT auth  
**Nyelvek:** magyar, német, angol

Teljes dokumentáció: [documentation/EventFlow_Dokumentacio.docx](documentation/EventFlow_Dokumentacio.docx)  
Frissítés: `python documentation/update_docx.py` (stílus megőrizve)

---

## Szerepkörök

| Szerep | Belépés után | Fő feladat |
|--------|--------------|------------|
| **Admin** | Admin irányítópult | Felhasználók, esemény profil, audit napló, előadók, demo adatok |
| **Szervező (booker)** | Naptár / program | Foglalás, szerkesztés, lemondás, tömeges módosítás |
| **Látogató (attendee)** | Nyilvános program | Böngészés, mentett program, ICS export, értesítések |
| **Vendég** | Bejelentkezés nélkül | Program böngészése (mentés nélkül) |

Demó fiókok: `admin@example.com` / `admin123` · `booker@example.com` / `booker123` · `attendee@example.com` / `attendee123`

---

## Gyors indítás (fejlesztés)

```bash
npm install
cp .env.example .env
# MariaDB: importáld src/backend/eventflow.sql (vagy használd a Docker db szolgáltatást)
npm run seed
npm run server   # Backend → http://localhost:3000
npm run dev      # Frontend → http://localhost:5173
```

Üres adatbázis esetén az admin felületen: **Demo adatok betöltése**, vagy `npm run seed`.

---

## Production

### Docker (ajánlott)

```bash
cp .env.example .env
# Kötelező: JWT_SECRET=hosszú-véletlen-string
docker compose up --build -d
```

- Alkalmazás: http://localhost:3000  
- Health: http://localhost:3000/api/health  
- Seed konténerben: `docker compose exec app npm run seed`

### Kézi telepítés

```bash
npm ci
npm run build
# .env: NODE_ENV=production, JWT_SECRET=...
npm run start
```

Production módban a backend kiszolgálja a `dist/` frontendet is.

---

## NPM parancsok

| Parancs | Leírás |
|---------|--------|
| `npm run dev` | Frontend dev szerver (Vite) |
| `npm run server` | Backend API |
| `npm run start` | Production backend (+ statikus frontend) |
| `npm run build` | TypeScript + Vite production build |
| `npm run seed` | Demo felhasználók, termek, előadók, előadások |
| `npm test` | Backend unit tesztek |
| `npm run lint` | ESLint |

---

## Környezeti változók

| Változó | Prod | Leírás |
|---------|------|--------|
| `JWT_SECRET` | **Kötelező** | JWT aláíró kulcs (dev alapértelmezés productionben tiltott) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | Igen | MariaDB |
| `CLIENT_URL` | Ajánlott | CORS origin |
| `NODE_ENV` | `production` | Statikus fájlok kiszolgálása |
| `PORT` | Nem | Alapértelmezett: 3000 |
| `JWT_EXPIRES_IN` | Nem | Alapértelmezett: 7d |
| `BCRYPT_SALT_ROUNDS` | Nem | Alapértelmezett: 10 |

---

## Fő funkciók (összefoglaló)

- **Esemény profil** — név, helyszín, dátumok, leírás; nyilvános hero + visszaszámláló
- **Előadások** — egy- és többnapos, sablonok (Keynote / Panel / Workshop), lemondás státusz
- **Ütközéskezelés** — terem (2 órás szabály), előadó; élő előnézet + szerveroldali validáció
- **Látogatói oldal** — keresés, szűrők, lista / napirend / naptár, „Ma” szűrő, előadók fül
- **Mentett program** — ütközés megerősítő modal, böngésző értesítés 15 perccel előtte
- **Admin** — felhasználók, booker termek, duplikált előadók egyesítése, audit napló, termek foglaltság
- **Tömeges szerkesztés** — nap eltolás / terem csere több előadáson
- **Export** — ICS (iCalendar)

---

## API (rövid)

Nyilvános: `GET /api/health` · `GET /api/event` · `GET /api/rooms` · `GET /api/sessions`  
Auth: `POST /api/auth/login` · `POST /api/auth/register` · `GET /api/auth/me`  
Részletes lista: [documentation/EventFlow_Dokumentacio.docx](documentation/EventFlow_Dokumentacio.docx) — 5. fejezet

---

## Projekt struktúra

```
src/
  backend/          Express API, auth, DB migrációk, seed
  frontend/         React UI, i18n (hu/de/en), komponensek
documentation/      EventFlow_Dokumentacio.docx + build_docx.py
docker-compose.yml  Production stack (app + MariaDB)
```

---

## Licenc

ISC
