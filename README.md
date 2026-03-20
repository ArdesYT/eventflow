EventFlow Projekt Dokumentáció
________________________________________
1. A projekt célja
Az EventFlow projekt egy modern, teljes veremű (Full-Stack) webalkalmazás, amelynek célja egy konferencia vagy rendezvény programfüzetének digitális kezelése. Az alkalmazás lehetővé teszi a látogatók számára az előadások böngészését, keresését és a részletek megtekintését.
A szoftver megoldást nyújt a hagyományos, papíralapú programfüzetek kiváltására. A rendszer biztosítja az adatok valós idejű elérését, gyors kereshetőséget és mobilbarát megjelenítést, így a résztvevők bárhol, bármikor értesülhetnek a menetrendről.
________________________________________
2. Alkalmazott technológiák (Technológiai stack)
Frontend:
A felhasználói felület React keretrendszerrel készült, TypeScript használatával. Ez biztosítja a típusbiztonságot, a jobb hibakezelést és a skálázható kódstruktúrát.
Backend:
A szerveroldali logika Node.js környezetben fut, Express.js keretrendszer segítségével. Ez egy könnyű, gyors és rugalmas megoldás REST API-k fejlesztésére.
Adatbázis:
A rendszer MariaDB relációs adatbázist használ, amely MySQL kompatibilis. Az adatbázis strukturált módon tárolja az előadásokat, előadókat és helyszíneket.
Kommunikáció:
A kliens és a szerver közötti kommunikáció Axios könyvtáron keresztül történik, amely aszinkron HTTP kéréseket tesz lehetővé.
Stíluskezelés:
Az alkalmazás egyedi CSS3 alapú megoldást használ, amely reszponzív kialakítást és modern, kártyaalapú felületet biztosít.
________________________________________
3. Funkcionális jellemzők
Dinamikus adatmegjelenítés:
Az előadások adatai (cím, előadó, helyszín, időpont) közvetlenül az adatbázisból töltődnek be, így mindig naprakész információk jelennek meg.
Intelligens keresés:
A felhasználók valós időben kereshetnek és szűrhetnek az előadások között cím vagy előadó neve alapján.
Automatikus formázás:
A rendszer a nyers időbélyegeket automatikusan felhasználóbarát, magyar nyelvű formátumra alakítja (pl. napnév és óra:perc).
Állapotkezelés:
Betöltés közben vizuális visszajelzés (loader) jelenik meg, hiba esetén pedig érthető hibaüzenet tájékoztatja a felhasználót.
________________________________________
4. Rendszerarchitektúra
Adatréteg:
MariaDB adatbázis táblák (sessions, speakers, rooms) tárolják az adatokat.
Logikai réteg (API):
A Node.js alapú szerver kezeli az adatbázis-kapcsolatot, végrehajtja a lekérdezéseket, és JSON formátumban továbbítja az adatokat.
Megjelenítési réteg:
A React alkalmazás feldolgozza a JSON válaszokat, és komponensekre bontva jeleníti meg az adatokat (pl. Session Card).
________________________________________
5. Telepítés és futtatás
Adatbázis:
Indítsuk el a MariaDB szervert (például XAMPP használatával).
Szerver:
Navigáljunk az src/backend mappába, majd futtassuk:
npx ts-node server.ts
Kliens:
Navigáljunk az src/frontend mappába, majd futtassuk:
npm run dev
Ezután nyissuk meg a böngészőben a megadott helyi címet.

