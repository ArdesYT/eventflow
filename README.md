# EventFlow

Konferencia- és eseményprogram-kezelő webalkalmazás: előadások ütemezése, látogatói program, adminisztráció.

**Verzió:** 1.0.0  
**Stack:** React (Vite) · Express · MariaDB · JWT (Bearer token)  
**Nyelvek:** magyar, német, angol

Teljes dokumentáció: [documentation/EventFlow_Dokumentacio.docx](documentation/EventFlow_Dokumentacio.docx)

---

## Szerepkörök

| Szerep | Belépés után | Fő feladat |
|--------|--------------|------------|
| **Admin** | Admin irányítópult | Felhasználók, esemény profil, audit napló, előadók, demo adatok |
| **Szervező (booker)** | Programkezelés – naptárnézet | Foglalás, szerkesztés, lemondás, tömeges módosítás |
| **Látogató (attendee)** | Nyilvános program | Böngészés, mentett program, ICS export, értesítések |
| **Vendég** | Bejelentkezés nélkül | Program böngészése (mentés nélkül) |

Demó fiókok: `admin@example.com` / `admin123` · `booker@example.com` / `booker123` · `attendee@example.com` / `attendee123`

### A feladatok helye

- **Admin és szervező – Programkezelés:** közös munkaterület, váltható lista-, naptár- és napirendnézettel. Új foglalás a naptár napjára kattintva indul: az űrlap kezdő és befejező dátuma a kiválasztott nap. Külön „Új foglalás” gomb nincs. Export az eszköztáron; szerkesztés, másolás, lemondás, visszaállítás és törlés kizárólag az előadás részleteinél. Tömeges módosítás a lista kijelölési módjában.
- **Szervező – Áttekintés:** összesítések; az előadásra kattintás a Programkezelés részletezőjébe vezet.
- **Admin – Előadók:** előadó létrehozása, szerkesztése, törlése és egyesítése. A foglalási űrlap és az előadás API is csak meglévő `speaker_id` értéket fogad el; a `speaker_name` nem hoz létre előadót. Új előadót először a `POST /api/speakers` végponton kell felvenni.
- **Admin – Áttekintés:** üres adatbázis esetén itt tölthetők be a demo adatok. A felhasználók, teremhozzárendelések és eseményprofil saját menüpontjukban kezelhetők.
- **Látogató:** mentés és eltávolítás az előadás részleteinél, minden megjelenítési nézetből ugyanazon a felületen. Lemondott előadás is eltávolítható. Export a program eszköztárán, értesítések a Mentett programom fülön.

---

## Gyors indítás (fejlesztés)

```bash
npm install
cp .env.example .env
# MariaDB: lásd „Adatbázis beállítása” alább
npm run seed
npm run server   # Backend → http://localhost:3000
npm run dev      # Frontend → http://localhost:5173
```

Üres adatbázis esetén az admin felületen: **Demo adatok betöltése**, vagy `npm run seed`.

---

## Adatbázis beállítása

### XAMPP / helyi MariaDB

1. Indítsd el a MySQL/MariaDB szolgáltatást.
2. phpMyAdmin: hozd létre az `eventflow` adatbázist, importáld a `src/backend/eventflow.sql` fájlt.
3. A `.env` fájlban a hitelesítő adatok egyezzenek a MariaDB felhasználóval:

```env
DB_HOST=localhost
DB_USER=eventflow      # vagy root XAMPP-nál
DB_PASS=eventflow      # XAMPP root alapértelmezés: üres
DB_NAME=eventflow
```

Ha `Access denied for user 'eventflow'` hibát kapsz, hozd létre a felhasználót phpMyAdminban, vagy állítsd át a `.env`-et root fiókra.

### Docker (csak adatbázis)

```bash
docker compose up db -d
# .env: DB_USER=eventflow, DB_PASS=eventflow
```

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
```

`.env` production példa:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=hosszú-véletlen-kulcs
CLIENT_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=eventflow
DB_PASS=eventflow
DB_NAME=eventflow
```

```bash
npm run start
```

Nyisd meg: http://localhost:3000

A backend kiszolgálja a `dist/` frontendet is. A `dist/index.html` fájlt **ne** nyisd meg közvetlenül — az API nélkül nem működik.

---

## NPM parancsok

| Parancs | Leírás |
|---------|--------|
| `npm run dev` | Frontend dev szerver (Vite) |
| `npm run server` | Backend API (development) |
| `npm run start` | Production backend (+ statikus frontend) |
| `npm run build` | TypeScript + Vite production build |
| `npm run seed` | Demo felhasználók, termek, előadók, előadások |
| `npm test` | Backend és szerepkörönkénti felületi regressziós tesztek |
| `npm run lint` | ESLint |

---

## Környezeti változók

| Változó | Prod | Leírás |
|---------|------|--------|
| `JWT_SECRET` | **Kötelező** | JWT aláíró kulcs (dev alapértelmezés productionben tiltott) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | Igen | MariaDB |
| `CLIENT_URL` | Ajánlott | CORS origin (productionben: http://localhost:3000) |
| `NODE_ENV` | `production` | Statikus fájlok kiszolgálása |
| `PORT` | Nem | Alapértelmezett: 3000 |
| `JWT_EXPIRES_IN` | Nem | Alapértelmezett: 7d (.env), fallback: 1d (kód) |
| `BCRYPT_SALT_ROUNDS` | Nem | Alapértelmezett: 10 |

---

## Hitelesítés

A rendszer **JWT Bearer token** alapú hitelesítést használ (nem `X-User-Id` fejlécet).

1. `POST /api/auth/login` → `{ user, token }`
2. A frontend elmenti a tokent (`authStorage.ts`) és minden védett kéréshez hozzáadja: `Authorization: Bearer <token>` (`authFetch.ts`)
3. A backend middleware (`auth.ts`): `authenticate`, `requireAdmin`, `requireBookerOrAdmin`, `requireAttendee`

---

## Fő funkciók

- **Esemény profil** — név, helyszín, dátumok, leírás; nyilvános hero + visszaszámláló
- **Előadások** — egy- és többnapos, sablonok (Keynote / Panel / Workshop), lemondás státusz
- **Ütközéskezelés** — terem (2 órás szabály + átfedés), előadó; kliens előnézet + **szerveroldali validáció** (`sessionConflicts.ts`)
- **Látogatói oldal** — keresés, szűrők, lista / napirend / naptár, „Ma” szűrő, előadók fül
- **Mentett program** — `user_schedule` tábla, ütközés-modal, böngésző értesítés 15 perccel előtte
- **Admin** — felhasználók, booker termek, duplikált előadók egyesítése, audit napló, termek foglaltság
- **Tömeges szerkesztés** — nap eltolás / terem csere több előadáson
- **Export** — ICS (iCalendar)

---

## API végpontok

Minden védett végpont: `Authorization: Bearer <JWT>` fejléc.

### Nyilvános

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/api/health` | Állapot, DB kapcsolat |
| GET | `/api/event` | Esemény profil |
| GET | `/api/rooms` | Termek listája |
| GET | `/api/sessions` | Összes előadás |

### Auth

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| POST | `/api/auth/register` | Regisztráció (attendee) |
| POST | `/api/auth/login` | Bejelentkezés → `{ user, token }` |
| GET | `/api/auth/me` | Aktuális felhasználó |

### Mentett program (attendee)

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/api/my-schedule` | Saját mentett előadások |
| POST | `/api/my-schedule/:sessionId` | Előadás mentése |
| DELETE | `/api/my-schedule/:sessionId` | Mentés törlése |

### Előadások (booker / admin)

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| POST | `/api/sessions` | Új előadás (szerveroldali ütközésellenőrzés) |
| PATCH | `/api/sessions/:id` | Szerkesztés |
| PATCH | `/api/sessions/:id/status` | Lemondás / visszaállítás |
| DELETE | `/api/sessions/:id` | Törlés |
| PATCH | `/api/sessions/bulk` | Tömeges módosítás |
| GET | `/api/sessions/saves` | Mentések száma előadásonként |

### Előadók (booker / admin)

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/api/speakers` | Lista |
| POST/PATCH/DELETE | `/api/speakers` | CRUD (admin) |
| POST | `/api/speakers/merge` | Duplikátum egyesítés |

### Admin

| Metódus | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/api/admin/users` | Felhasználók |
| PATCH | `/api/admin/users/:id` | Szerepkör módosítás |
| PUT | `/api/admin/users/:id/rooms` | Booker termek |
| DELETE | `/api/admin/users/:id` | Felhasználó törlés |
| GET | `/api/admin/activity-log` | Audit napló |
| PATCH | `/api/admin/event` | Esemény profil |
| POST | `/api/admin/seed-demo` | Demo adatok betöltése |

Részletes leírás: [documentation/EventFlow_Dokumentacio.docx](documentation/EventFlow_Dokumentacio.docx) — 5. fejezet

---

## Projekt struktúra

```
src/
  backend/          Express API, auth, DB migrációk, seed, ütközésellenőrzés
  frontend/         React UI, i18n (hu/de/en), komponensek
    lib/
      authStorage.ts, authFetch.ts    JWT perzisztencia és API hívások
      scheduleApi.ts, scheduleStorage.ts   Mentett program
documentation/      EventFlow_Dokumentacio.docx
docker-compose.yml  Production stack (app + MariaDB)
```

---

## Licenc

ISC
