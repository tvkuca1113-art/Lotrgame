# THE LAST HEARTH: RINGS OF THE NORTH
## Objašnjenje projekta (bosanski)

> „Počinješ sa slomljenim mačem i bez mjesta za spavanje. Svaki prsten koji
> pronađeš mijenja način na koji se boriš. Svaka pobjeda približava tvoje buduće
> uporište.“

Ovo je kompletna, igriva akciona RPG igra koja radi u pregledniku (browseru) na
računaru i na mobitelu. Ovaj dokument objašnjava šta je isporučeno, kako se
pokreće, kako je napravljeno i šta je provjereno.

**Napomena:** ovo je neslužbeni, nekomercijalni fan-projekat. Detalji su na dnu
dokumenta, u poglavlju [Pravna napomena](#pravna-napomena).

---

## 1. Šta je isporučeno

| Stavka | Stanje |
|---|---|
| Kompletan izvorni kod | ✅ `src/`, `tools/`, `tests/` |
| Svi grafički materijali | ✅ 113 slika + 109 atlas opisa (222 fajla, 23 MB), generisani kodom iz `tools/art` |
| Zvuk i muzika | ✅ sintetizuje se uživo (Web Audio), bez audio fajlova |
| Produkcijski build | ✅ `dist/` — obična statička stranica |
| ZIP paket | ✅ `dist-zip/the-last-hearth-*.zip` (19,4 MB) |
| README sa komandama | ✅ `README.md` |
| Rezultati testiranja | ✅ `VERIFICATION.md` |
| Fajlovi za objavu na internetu | ✅ `deploy/` (nije objavljeno) |

### Sadržaj igre

- **30 nivoa** kampanje kroz **6 regionalnih poglavlja**
- **30 bosova**, od kojih su nivoi 5, 10, 15, 20, 25 i 30 **glavni bosovi
  poglavlja** (imaju dvije ili tri faze)
- **Nivo lika od 1 do 30**, 29 talent-poena, tri grane talenata po deset čvorova
- **Tri porodice oružja**: mač i štit, luk, dvoručna sjekira
- **12 prstenova**, rangovi 1–10, četiri mjesta za nošenje, dva utora u naselju,
  **6 kombinacija (sinergija)**
- **Naselje** koje raste: logor → drvena koliba → kamena kuća → utvrđeno
  dvorište → mali zamak
- **Četiri godišnja doba** sa stvarnim uticajem na igru
- **Trajno snimanje**, izvoz i uvoz sačuvane igre
- **Dva kraja**, oba čuvaju kolekciju, zgrade i mogućnost daljeg igranja

---

## 2. Kako se pokreće

Potreban je **Node.js 20.11 ili noviji** (preporučeno 22.x). Ništa drugo —
nema baze podataka, nema servera, nema API ključeva.

```bash
npm install          # instalira zavisnosti (verzije su zaključane u package-lock.json)
npm run assets       # generiše svu grafiku u public/assets  (traje 2–3 minute, jednom)
npm run dev          # razvojni server na http://localhost:5173
```

Za konačnu verziju:

```bash
npm run build        # provjera tipova + produkcijski build u dist/
npm run preview      # pokreće dist/ na http://localhost:4173
```

Testovi i pakovanje:

```bash
npm test             # 137 testova
npm run verify       # provjera tipova + testovi
npm run package      # pravi ZIP u dist-zip/
```

`npm run dev` i `npm run build` sami pokreću `npm run assets`, tako da je nakon
svježeg preuzimanja dovoljno `npm install` pa `npm run dev`.

---

## 3. Upravljanje

### Računar (tastatura i miš)

| Radnja | Tipka |
|---|---|
| Kretanje | `W` `A` `S` `D` ili strelice |
| Ciljanje | Pokazivač miša |
| Napad | Lijevi klik |
| Radnja oružja (blok / nategnuti hitac / teški udarac) | Desni klik |
| Izmicanje (dodge) | `Space` |
| Moć prstena I / II | `Q` / `E` |
| Napitak (liječenje) | `R` |
| Interakcija | `F` |
| Inventar | `I` |
| Mapa / dnevnik | `M` |
| Pauza | `Escape` |
| Rotiranje zgrade pri gradnji | `R` |
| Poništi zadnje postavljanje | `Z` |
| Ukloni zgradu na kojoj stojiš | `X` |

Sve tipke se mogu promijeniti u **Postavkama**. Postoji i **režim samo za
tastaturu**: uključi *Keyboard aiming* i ciljanje prati smjer kretanja, pa miš
uopšte nije potreban.

### Mobitel (dodir)

- **Lijeva polovina ekrana je virtuelni džojstik** — pritisni bilo gdje i vuci.
- Na desnoj strani su dugmad za **napad, radnju oružja, izmicanje, dva prstena,
  liječenje** i **kontekstualnu interakciju**.
- **Kretanje i napad istovremeno rade.**
- U Postavkama su: **raspored za ljevoruke**, **pomoć pri ciljanju**, **veličina
  džojstika** i **veličina dugmadi**. Svako dugme je najmanje 48 CSS piksela.

---

## 4. Kako igra teče

1. Na mapi kampanje biraš misiju. Prije polaska vidiš: cilj, preporučeni nivo,
   trenutno godišnje doba, sezonsku prečicu, bosa i **tačne nagrade**.
2. Istražuješ nivo, boriš se i ispunjavaš zadatak. Zadaci su spašavanje,
   sakupljanje, rušenje, paljenje, sabotaža i jedna **pratnja**: kola koja se
   kreću samo dok hodaš uz njih. Napadači ih mogu polomiti, ali to nikada ne
   prekida misiju — kola stanu gdje jesu, sama se poprave nakon nekoliko
   sekundi, a sve sigurne stanice do kojih si već stigao ostaju osvojene.
3. Ulaziš u arenu bosa. **Tačka spašavanja (checkpoint) je neposredno prije
   svakog bosa.**
4. Pobjeđuješ bosa, uzimaš nagradu i vraćaš se kući.
5. Unapređuješ prsten, opremu ili zgradu i krećeš ponovo — s drugačijim planom.

**Smrt te ne košta ničega što si našao.** Arena i bos se resetuju, napitak se
dopuni na stanje sa checkpointa, a prstenovi, oprema, novac i zgrade ostaju
tvoji. Nagrade se dodjeljuju i označavaju kao preuzete u **istoj snimljenoj
transakciji**, pa smrt, ponovni pokušaj ili ponovno učitavanje **ne mogu
udvostručiti nijednu nagradu**.

---

## 5. Prstenovi — srce igre

Dvanaest originalnih „manjih“ prstenova. Svaki ima aktivnu moć, manji pomoćni
efekat, efekat u naselju, evolucije na rangu 4 i 7, svoju ikonu i kratku priču.

| Prsten | Zagarantovano sa | Aktivna moć |
|---|---|---|
| Ember | Nivo 1 (pronalazak) | Vatreni luk koji pali označeno rastinje |
| Stoneward | Bos nivoa 2 | Barijera koja eksplodira kad pukne |
| Windstep | Bos nivoa 4 | Nalet u smjeru gledanja uz sjekući vjetar |
| Thornwake | Bos nivoa 6 | Korijenje koje drži obične protivnike |
| Dawnward | Bos nivoa 8 | Impuls svjetla koji razbija tamne čini |
| Venomcoil | Bos nivoa 9 | Otrovni projektil s ograničenim slaganjem |
| Frostwake | Bos nivoa 11 | Ledeni konus; smrzava označenu vodu |
| Iron Oath | Bos nivoa 13 | Tempirana odbrana koja ošamuti napadača |
| Echo | Bos nivoa 14 | Ponavlja sljedeći napad oružjem, slabije |
| Stormcall | Bos nivoa 17 | Munja koja skače između nekoliko protivnika |
| Duskveil | Bos nivoa 21 | Kratki skok koji ostavlja sjenu-mamac |
| Last Hearth | Bos nivoa 25 | Krug zaklona koji presreće projektile |

**Pravila koja se strogo poštuju:**

- Najveći upotrebljivi rang: `min(10, 1 + floor((nivo_lika − 1) / 3))`
- Snaga raste po: `1 + 0,06 × (rang − 1)`
- **Domet, skraćenje hlađenja i kontrola** imaju **svaki svoje odvojeno
  ograničenje** — nijedna vrijednost ne može pobjeći.
- Unapređenje u kovačnici je **deterministično** (fiksna cijena u zlatu i
  krhotinama); **prsten se nikada ne uništava**.
- **Duplikat** prstena postaje krhotine uz jasnu poruku — kolekcija ostaje
  pregledna.
- Četiri mjesta za nošenje: Aktivno I od početka, Aktivno II poslije nivoa 5,
  Pomoćno I poslije nivoa 12, Pomoćno II poslije nivoa 20. **Pomoćno mjesto daje
  samo pomoćni efekat**, nikada aktivnu moć.
- **Prsten može biti samo na jednom mjestu istovremeno** — ili se nosi, ili je
  ugrađen u naselju, nikada oboje.

### Sinergije

Šest kombinacija, svaka traži **oba prstena u dva aktivna mjesta**. Svaka ima
svoje interno hlađenje i tvrdo ograničenje efekta, i **efekti sinergije ne mogu
pokrenuti novu sinergiju, Echo, niti dodatni lanac** — to je provjereno
testovima.

---

## 6. „Nosi ga ili gradi s njim“

Poslije nivoa 10 u naselju se otvaraju **dva utora za prstenove**. Kad ugradiš
prsten, aktivira se njegov efekat u naselju i to mjesto se **vidljivo mijenja** —
ali taj prsten ne možeš nositi dok ga ne izvadiš. Zamjena je kod kuće besplatna,
a vađenje prstena **nikada ne briše zgradu** niti gasi radionicu.

Tri prstena daju i **„vid prstena“** na određenim ruševinama: Ember otkriva
tragove toplote, Dawnward natpise, Frostwake zaleđeni prelaz. To otvara samo
**neobavezne** prečice, skrivene zalihe i priče — **obavezni put uvijek ima
običan prolaz**.

---

## 6b. Izazovi (sadržaj nakon kampanje)

Maksimalni nivo ostaje 30 i nakon kraja priče. U naselju se pojavi dugme
**Challenges** kada ima šta da se otvori (odbrana naselja nakon 20 pređenih
nivoa, ostalo nakon završetka kampanje):

- **Tabla bosova** — ponovo se boriš protiv bilo kojeg bosa kojeg si već
  pobijedio, samo protiv njega, počinješ odmah pred arenom. Prvi put plaća punu
  nagradu, ponavljanje 35%.
- **Otežana ponavljanja** — cijeli nivo s protivnicima jačim za šest nivoa i
  bosom na 150% zdravlja.
- **Šestorica** — svih šest bosova poglavlja jedan za drugim. Zdravlje i napici
  se prenose iz borbe u borbu, a ukupno vrijeme je tvoj lični rekord.
- **Odbrana naselja** — osam talasa kod kuće, pokreće se svjesno s table. Može
  se izgubiti, ali se time ništa ne gubi: nijedna zgrada se ne ošteti i nijedan
  resurs se ne oduzme ako te probiju.
- Ciljevi sakupljanja, lični rekordi, zastave i boje plašta.
- **Slika tvrđave** — PNG tvog naselja i opreme, nacrtan iz tvoje snimljene igre
  lokalno u pregledniku. Ništa se nigdje ne šalje.

Nijedan izazov ne daje iskustvo niti označava nivo kampanje kao pređen, pa se
njima ne može preskočiti kampanja niti prijeći nivo 30.

---

## 7. Snimanje igre

- Čuva se lokalno u **IndexedDB**, u verzionisanom formatu, uz **rezervnu kopiju
  posljednjeg ispravnog stanja** pri svakom snimanju.
- **Automatsko snimanje** poslije nagrada, kupovina, unapređenja, promjena u
  naselju i na svakom checkpointu — i **ne oslanja se samo na zatvaranje
  stranice**.
- **Ponovno učitavanje tokom borbe s bosom vraća te na ulaz u arenu.**
- **Izvoz** pravi JSON fajl; **uvoz** provjerava verziju, sve ID-eve, sve opsege
  i sve resurse, čuva rezervnu kopiju onoga što mijenja, i prijavi šta je morao
  popraviti.
- **Nova igra nikada tiho ne briše postojeću kampanju** — trenutno stanje se
  arhivira u poseban slot koji možeš vratiti iz Postavki.
- Ako snimanje ne uspije (privatni prozor, blokirana pohrana), igra nastavlja da
  radi u memoriji, **jasno kaže da je problem sa snimanjem** i ponudi izvoz.

---

## 8. Kako je napravljeno

### Tehnologija

**TypeScript + Vite 7 + Phaser 3.90.0.** Verzije su zaključane u
`package-lock.json`. Phaser 3.90 je posljednje stabilno izdanje serije 3 i
dokumentovano je u cijelosti.

### Struktura

```
src/
  content/   sloj sadržaja koji se može zamijeniti — nivoi, bosovi, prstenovi,
             protivnici, talenti, oprema, zgrade i SAV tekst
    locale/  svaki tekst koji igrač vidi, po ključevima (za prevod)
  systems/   sistemi igre: napredak, prstenovi, borba, ekonomija, inventar,
             gradnja, godišnja doba, snimanje, nasumičnost, unos, resursi
  world/     generisanje nivoa i naselja, izometrijsko iscrtavanje
  entities/  igrač, protivnici, bosovi, projektili, efekti
  scenes/    Phaser scene: Boot, Title, Map, Home, Stage, UI, Menu, Result, Ending
  audio/     Web Audio sinteza, biblioteka zvukova i muzika
  ui/        zajednički skup UI elemenata
tools/art/   procedurni generator grafike
tools/qa/    skripte za provjeru u pregledniku
tests/       vitest testovi
```

### Važne inženjerske odluke

- **Stanja igre su eksplicitna:** `BOOT, TITLE, HOME, EXPLORING, BOSS_INTRO,
  BOSS_FIGHT, STAGE_COMPLETE, PAUSED, DEFEATED, ENDING`, sa deklarisanim
  dozvoljenim prelazima.
- **Fiksni korak simulacije od 60 Hz.** Kretanje, šteta, regeneracija, hlađenja i
  godišnja doba **nikada ne zavise od broja sličica**. Dugi zastoji se
  ograničavaju umjesto da se „premotavaju“.
- **Fizika je u svjetskim koordinatama**, a samo iscrtavanje prevodi u
  izometriju — pa sudari i pogoci ne moraju razmišljati o kameri.
- Igra se **pauzira kad kartica nije vidljiva** i **čisti zaglavljeni unos**
  poslije gubitka fokusa, prekida dodira i promjene orijentacije.
- **Sadržaj je odvojen sloj.** Sva imena i priča iz franšize su u `src/content`;
  funkcija `validateContent()` odmah javlja ako nešto nedostaje.

### Grafika — sve je napravljeno ovdje

**Svaka slika u `public/assets` generisana je kodom iz `tools/art`.** Ništa nije
preuzeto, precrtano ni uvezeno sa strane; sam generator je dokaz porijekla, a
svaki PNG nosi svoju licencu upisanu u `tEXt` zapis.

**Generator daje uvijek isti rezultat.** Kada se cijeli `public/assets` obriše i
napravi ponovo od nule, svih 222 fajla ispadnu bajt po bajt identični onima koje
projekat nosi — to je provjereno tako što je upravo to i urađeno, pa upoređeno.
To znači da se grafika u bilo kojem trenutku može ponovo napraviti iz koda i
uporediti s onim što je isporučeno.

Build pamti „otisak“ generatora i preskače pravljenje grafike kada se ništa nije
promijenilo, pa `npm run build` ne plaća tih dva i po minuta svaki put.
Ako želiš ponovo napraviti grafiku bez obzira na to: `npm run assets -- --force`.

Generator sadrži:

- **PNG enkoder bez ijedne zavisnosti** (indeksirani i puni kolor) i **softverski
  rasterizator** sa naduzorkovanjem, pa ivice izgledaju crtano, a ne „stepenasto“;
- **mali 3D skelet i izometrijsku projekciju** — svih osam smjerova svakog lika
  dolazi iz jednog istog sistema poza, umjesto osam ručno crtanih setova;
- **biblioteku animacija** dijeljenu između čovjekolikih, četveronožnih,
  paukolikih i sablasnih skeleta;
- generatore za **teren, objekte, arhitekturu naselja, borbene efekte, ikone
  prstenova i UI okvire**.

Grafika je podijeljena u pakete: **core** (~3 MB) se učitava na startu, a **paket
regije** (~2–3 MB) tek kad prvi put odeš u to poglavlje.

**Zvuk se sintetizuje uživo** preko Web Audio API-ja — koraci, udarci oružja,
efekti prstenova, najave bosova, ambijent i generativna muzička podloga. **Nema
audio fajlova.** Zvuk kreće tek nakon stvarne radnje korisnika, svaka grupa ima
svoj regulator jačine, i **igra je potpuno igriva bez zvuka**.

---

## 9. Šta je provjereno

Detaljni brojevi su u `VERIFICATION.md`. Ukratko:

- **137 automatskih testova** pokriva štetu i hlađenja, ograničenja nivoa i
  ranga prstena, isključivost mjesta za prstenove, **nemogućnost rekurzije
  sinergija**, transakcije kupovine i povrata, **jednokratne nagrade**, prelaze
  godišnjih doba, migraciju i uvoz snimljene igre, i **prohodnost svih ciljeva u
  sva četiri godišnja doba na svih 30 nivoa**.
- **Simulacija ekonomije** kroz cijelu kampanju potvrđuje da se mali zamak i
  puna linija opreme mogu priuštiti bez ponavljanja nivoa. Prva verzija je
  ostavljala samo 0,04 % rezerve — to je ispravljeno povećanjem prihoda od
  istraživanja, a ne traženjem da igrač „grinda“.
- **Provjere u pravom pregledniku** (Chromium): pokretanje, prve minute igre,
  kretanje i napad istovremeno, prstenovi, izmicanje, napitak, snimanje i ponovno
  učitavanje, pauza, i **obilazak svih 30 arena bosova**.

### Razvojni alati

`?fixture=<nivo>` otvara bilo koji nivo odmah pred bosom, sa potpuno otključanim
likom — tako se sve 32 arene mogu pregledati bez ponovnog igranja kampanje.
**Taj režim nikada ne čita ni ne piše tvoju sačuvanu igru.**

```
http://localhost:5173/?fixture=25
http://localhost:5173/?fixture=20&difficulty=veteran&at=entrance
```

---

## 10. Objava na internetu

`dist/` je obična statička stranica — HTML, JavaScript i slike. Nema koda na
serveru, nema API-ja, nema prijave na račun. Može se postaviti na bilo koji
običan HTTPS hosting.

U folderu `deploy/` su spremne konfiguracije za Netlify, Vercel, Cloudflare
Pages, nginx, Caddy i GitHub Actions.

> **Važno i iskreno:** **ništa nije objavljeno na internetu.** Fajlovi su
> pripremljeni; objava je zaseban korak koji ti odlučuješ kada ćeš napraviti.
> Zato u ovoj isporuci **nema linka za pregled**.

---

## 11. Šta nije uključeno (i zašto)

Po dogovoru iz specifikacije, izvan ovog prvog izdanja su: online igra za više
igrača, PvP, korisnički računi, trgovina između igrača, plaćene prodavnice i
„live-service“ resetovanja. Sadržaj i sačuvane igre su namjerno napravljeni tako
da se mogu proširivati kasnije (verzionisan format snimanja s migracijom,
sadržaj kao zaseban sloj, paketi grafike po regijama).

Poznata ograničenja ovog izdanja su iskreno popisana na kraju
`VERIFICATION.md` — vrijedi ih pročitati prije nego što planiraš sljedeći korak.

---

## Pravna napomena

Ovo je **neslužbeni, nekomercijalni fan-projekat** smješten u Međuzemlje.
Gospodara prstenova i njegov svijet stvorio je J.R.R. Tolkien. Ovaj projekat
**nije povezan sa, niti odobren od** Tolkien Estate-a, Middle-earth
Enterprises-a, Embracer Group-e, niti bilo kojeg vlasnika filmskih ili igračkih
prava.

- **Nisu korišteni** snimci iz filmova, filmska muzika, likovi glumaca, niti
  materijali izvučeni iz postojećih igara. Sva grafika, tekst i zvuk napravljeni
  su za ovaj projekat.
- **Ashen Regent, dvanaest prstenova, sjeverna dolina, naselje i svi imenovani
  bosovi su originalni** i izmišljeni za ovu sporednu priču. Prstenovi u igri su
  male, „kućne“ tvorevine — **nisu Jedinstveni prsten** i nisu zamjena za
  kanonske Velike prstenove.
- Prepoznatljivi narodi i stvorenja Međuzemlja pojavljuju se kao dio svijeta:
  orci, goblini, Uruk-hai, vargovi, trolovi, divovski pauci, humkaši i jedan
  susret s Nazgûlom.
- Imena i priča iz franšize drže se isključivo u `src/content`, pa se cijeli
  ambijent može zamijeniti.

Licenca za kod i generisanu grafiku je u fajlu `LICENSE`.
