# Herkules — UI/UX review i plan unapređenja mobilnog iskustva

Datum: 12. oktobar 2026. Autor: Codex. Status: predlog za implementaciju, bez izmena aplikacionog koda.

## 1. Glavna preporuka

Aktivni trening treba da postane ekran za **trenutnu vežbu ili trenutni krug superseta**, sa neposrednim unosom serije i pregledom celog treninga na jedan dodir. Najveća korist dolazi iz boljeg redosleda informacija i navigacije, a ne iz smanjivanja fontova i dugmadi.

Preporučeni završni oblik:

- Fokusirani prikaz kao podrazumevani mobilni režim: trenutna vežba, cilj, prethodna odgovarajuća serija, stvarne vrednosti za unos i potvrda.
- Superset kao zajednički blok sa jasnim redosledom A1 → A2 → odmor, bez traženja druge kartice skrolovanjem.
- „Pregled treninga” otvara kompaktnu listu svih vežbi i njihovog napretka; izbor vežbe odmah vraća na njen unos.
- Istorija, tehnika, zamena i napredne opcije ostaju dostupne, ali ne zauzimaju stalno prostor iznad serija.
- Vrednosti iz prethodnog treninga moraju biti jasno razdvojene od plana i od onoga što se sada beleži. Prazan unos ne sme neprimetno postati završena serija.

Prvo isporučiti pouzdanost unosa i kompaktniju karticu; zatim fokusirani tok i supersete. Ne menjati sve ekrane istovremeno.

## 2. Metod, obuhvat i ograničenja

Pregledani su korisnikov screenshot, otvorena produkciona aplikacija i lokalni kod na početnom commitu `9063ef5` (`main`). Produkciona verzija nije potvrđena kao isti commit: na primer, lokalni `Routines.tsx` već ima vidljiv „New plan”, dok ga je otvorena verzija prikazivala kroz dodatne akcije. Sledeći agent mora ponoviti kratku proveru na svojoj verziji.

Praktično pregledani ekrani: aktivni trening, sklapanje vežbe, dijalog završetka, Today, Calendar, Routines, PlanEditor, RoutineEditor, Exercises, Progress, History i Settings. Pregled koda dodatno pokriva početak treninga, HistoryDetail, ExercisePicker, intervale, zajedničke dijaloge, autentifikaciju i trener/klijent tokove. Auth, pozivi klijentima, različite uloge, stvarno beleženje i završavanje treninga nisu izvršavani na produkciji.

Prikazi od 390 × 844 i 360 × 800 CSS px ispitani su promenom viewporta desktop browsera. Ovo nije test stvarnog Android uređaja, Gboard tastature, TalkBack-a, instalirane PWA, mrežnog prekida ili zaključanog ekrana. Light tema i srpski prevod pregledani su kroz kod, ne kompletno u živom prikazu. Procene kontrasta u ovom dokumentu nisu sertifikacija pristupačnosti.

Nisu menjani unosi, planovi ni serije. Dijalog Finish otvoren je i zatvoren bez potvrde, sklapanje prve kartice vraćeno je u početno stanje, a browser vraćen na aktivni trening i prvobitnu veličinu. U dokumentu se ne objavljuju lični profil, telesna merenja ni screenshotovi naloga. Brojevi u predloženim primerima su ilustrativni.

Oznake dokaza: **UI** = viđeno u browseru; **kod** = potvrđeno čitanjem implementacije; **hipoteza** = predlog koji treba proveriti testiranjem sa korisnicima. Konkurenti su istraženi preko zvaničnih uputstava i njihovih prikaza, ne neposrednim testiranjem njihovih Android aplikacija. Dokumentovani obrazac ne dokazuje određeni procenat ubrzanja.

## 3. Šta već dobro funkcioniše

- Tri glavna odredišta, Today / Plan / Progress, daju dovoljno jednostavnu osnovnu navigaciju.
- Aktivni trening je izdvojen iz glavnog layouta. To je dobra osnova za fokusirani mobilni rad.
- Offline-first store, jedinice za prikaz, i18n, teme i snapshot treninga već postoje; sačuvati ih.
- Postoje automatski odmor, intervalni tajmer, wake lock, prethodne serije i alternativne vežbe.
- Postoje sklapanje kartica, NotesDisclosure i BottomSheet. Potrebno je poboljšati njihovu upotrebu, a ne uvoditi drugi sistem komponenti.
- Settings i check-in kartice već koriste sažetke i otkrivanje detalja na zahtev. Taj princip preneti na trening.

## 4. Nalazi po prioritetu

P0 = pouzdanost osnovnog unosa; P1 = najveća svakodnevna smetnja; P2 = naredno unapređenje. Prioriteti su procena proizvoda, ne izmerena učestalost grešaka.

| ID | Prioritet | Nalaz i dokaz | Posledica | Predložena intervencija |
| --- | --- | --- | --- | --- |
| W01 | P0 | UI prikazuje prethodne težine i opseg ponavljanja kao placeholder; `SetEditor` potvrđuje postojeći `set` bez obavezne validacije (kod). | Korisnik može misliti da je zabeležio prikazane vrednosti iako su polja prazna. | Jasna priprema vrednosti, validacija i jedna pouzdana komanda za potvrdu. |
| W02 | P1 | Sve vežbe početno otvorene. Na 390 × 844 dokument ima 3.782 px, prva kartica 534 px; na 360 × 800 ukupno 3.822 px (UI/DOM). | Duga navigacija, naročito pri smenjivanju superseta. | Fokusirani blok + pregled treninga; kompaktnija lista kao međukorak. |
| W03 | P1 | Prva kartica i sklopljena ima 180 px na 390 px: alternativa, partneri i prescription ostaju van `expanded` uslova (UI/kod). | Samo automatsko sklapanje ne rešava visinu. | Zaseban sažeti header sa nazivom, napretkom i jednom linijom plana. |
| W04 | P1 | Iznad serija su video, duga alternativa, RPE/RIR bedževi, note preview, tempo, swap/delete i istorija (UI). | Najčešći posao je potisnut ispod pomoćnih funkcija. | Unos neposredno posle kratkog prescription reda; detalji i retke akcije na zahtev. |
| W05 | P1 | Potvrda i meni serije imaju visinu 36 px, inputi 40 px; header alati 36 × 36 px (UI/DOM). | Slabije mete za dodir tokom vežbanja; odstupanje od repo minimuma 44 px. | Efektivna meta najmanje 44 px, cilj 48 px; sažimati dekoraciju, ne mete. |
| W06 | P1 | `previousSetsForExercise` vraća završene serije; predlozi uzimaju `previous[setIndex]`, bez zasebnog uparivanja zagrevanja, strane i smera (kod). | Poređenje i predlog mogu odgovarati pogrešnoj vrsti ili rednom mestu serije. | Semantičko uparivanje i vidljiv izvor predloga; legacy fallback označiti. |
| W07 | P1 | Superset ima dve velike odvojene kartice; nema automatske navigacije do partnera. Odmor se već računa posle celog kruga (kod). | Korisnik ručno vodi redosled i skroluje između partnera. | Zajednički blok, aktivna stanica i sledeći korak. Sačuvati postojeće pravilo odmora. |
| W08 | P1 | `handleComplete` poziva `void upsertSet`, pa odmah pokreće odmor (kod). | UI nema lokalnu potvrdu uspeha pre nastavka; ponašanje pri neuspelom upisu i brzim akcijama treba testirati. | Čekati lokalni commit, prikazati grešku/ponovni pokušaj, zaštititi dupli tap. |
| W09 | P1 | Swap/remove su stalno vidljivi; remove odmah poziva store bez lokalnog confirmation/undo toka u toj kartici (kod). | Retke i destruktivne radnje imaju previše vizuelne težine i povećavaju rizik pogrešnog dodira. | Meni vežbe; eksplicitna potvrda uklanjanja, naročito sa unetim podacima. |
| W10 | P1 | Napredak je ukupni broj završenih redova, bez imenitelja, a kartica je „logged” čim postoji jedna završena serija (kod). | Delimično završena vežba može izgledati kao gotova; nije jasno koliko je ostalo. | Razdvojiti „u toku” i „završeno”; brojati radne grupe/krugove i zagrevanje odvojeno. |
| W11 | P1 | Workout nema `SyncBar` iz `AppLayout`; dock odmora računa pomak preko `--bottom-nav-h` iako workout nema bottom nav (kod). | Status čuvanja je manje vidljiv, a timer može nepotrebno zauzimati sredinu donje zone. | Mali status lokalnog čuvanja i namenski workout dock bez rezervacije za nepostojeću navigaciju. |
| G01 | P1 | Plutajući Resume prekriva check-in, kartice i druge redove tokom skrola (UI). | Deo sadržaja i ciljnih površina zaklonjen je baš u zoni palca. | Rezervisani donji prostor za Resume traku ili kontekstualno skrivanje duplikata. |
| G02 | P1 | U RoutineEditor-u na 390 px jedna sklopljena kartica gubi vidljiv naziv pod ikonama i bedževima (UI). | Korisnik ne može pouzdano razlikovati vežbe. | Naziv u posebnom redu, min-width pravila, metapodaci ispod; retke akcije u meni. |
| G03 | P2 | Today ima veliku praznu sekciju „Nothing planned” i ponovljen Resume (UI). | Glavna radnja i check-in sadržaj nepotrebno razdvojeni. | Kratko prazno stanje; jedan dominantan Resume dok je kartica vidljiva. |
| G04 | P2 | Progress prvo prikazuje osam velikih statističkih kartica; grafikoni su ispod prvog ekrana (UI). | Teško je odmah odgovoriti „da li napredujem?”. | Prvo relevantan trend + 2–3 brojke; telesni sastav u zasebnoj sekciji. |
| G05 | P1 | History/Progress prikazuju neuobičajeno duga trajanja pojedinih sesija (UI); trajanje je ended_at − started_at (kod). | Prosek trajanja može zbunjivati i narušiti poverenje. Uzrok nije utvrđen. | Proveriti poreklo/uvoz/zaboravljen završetak; omogućiti pregled i eksplicitnu ispravku vremena, bez tihog menjanja istorije. |
| G06 | P2 | History sabija datum/naziv levo, metrike desno, uz ellipsis na uskom ekranu (UI). | Slaba čitljivost i poređenje. | Naziv i datum kao glavne linije; kratak red metrika ispod, filteri i pretraga. |
| G07 | P2 | Katalog je duga lista sa ponovljenim linkovima i odvojenim custom/system unosima istog naziva (UI/kod). | Sporiji izbor i nejasnoća koji unos koristiti. | Nedavno korišćene, relevantne alternative i filteri; ne spajati podatke samo po imenu. |
| G08 | P2 | Editors imaju Save pri dnu duge forme (UI/kod). | Korisnik mora skrolovati da bi sačuvao. | Vidljivo stanje izmena i dostupna Save radnja bez prekrivanja sadržaja. |

Za navedena merenja korišćen je CSS viewport sa desktop scrollbarom. Visina dokumenta nije broj korisnikovih prevlačenja. Približno 4,5 visine viewporta na 390 px opisuje obim sadržaja, ne rezultat usability testa.

## 5. Šta preuzeti iz sličnih aplikacija

| Aplikacija / izvor | Dokumentovan obrazac | Primena u Herkulesu | Ograničenje |
| --- | --- | --- | --- |
| FitNotes za Android | Jedna vežba sa poljima za sledeću seriju; navigacioni panel; istorija i grafikoni uz vežbu; prelazak na sledećeg partnera u grupi. | Fokusirani unos i pregled treninga dostupni bez vertikalnog traženja. | Ne kopirati skrivenu navigaciju samo preko logotipa/edge swipe-a. [Zvanično uputstvo](https://www.fitnotesapp.com/workout_tracking/). |
| FitNotes | Prethodne vrednosti popunjavaju polja; plus/minus koristi korak specifičan za vežbu. | Vidljive pripremljene vrednosti, jasno obeležene kao predlog, i opcionalni brzi koraci. | Planirani opseg nije stvarno izveden rezultat. Izvor je isto zvanično uputstvo iz prethodnog reda. |
| Hevy | „Previous” prikazuje prethodni rezultat; moguće je birati poslednji trening ili istu rutinu. | Istorija uz odgovarajuću seriju, sa datumom i jasnim kriterijumom. | Hevy eksplicitno razlikuje prethodne vrednosti od podrazumevanog unosa. [Uputstvo](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy). |
| Hevy | Smart Superset Scrolling prelazi do sledeće vežbe nakon potvrde serije. | Sledeća stanica superseta postaje aktivna, uz očuvanje mogućnosti ručnog izbora. | Primena u Herkulesu treba da menja fokus u stabilnom prostoru, bez dugih automatskih skrolova. [Uputstvo](https://help.hevyapp.com/hc/en-us/articles/35650286563095-The-Complete-Guide-to-Supersets-and-Smart-Superset-Scrolling). |
| Strong, iPhone i Android | Automatski odmor sa kompaktnim prikazom; veliki prikaz na zahtev; posebna podešavanja odmora za zagrevanje i radne serije. | Odmor ostaje vidljiv bez blokiranja unosa i pregleda sledećeg seta. | Dokumentacija je poslednji put ažurirana 8. februara 2021; ne tvrditi identičan izgled aktuelnog izdanja. [Uputstvo](https://help.strongapp.io/article/231-rest-timer). |

Zaključak iz izvora: koristan zajednički princip je blizina prethodnog rezultata, sledećeg unosa i odmora. Predlog fokusiranog Herkules ekrana je naša dizajnerska sinteza, ne tvrdnja da svi konkurenti koriste isti layout ili da je takav layout već dokazano bolji za ove korisnike.

## 6. Specifikacija aktivnog treninga

### 6.1. Hijerarhija informacija

Stalno vidljivo u normalnom stanju: naziv vežbe, pozicija u treningu, cilj ponavljanja/vremena/distance, radna serija/krug i strana, polja sa jedinicama, relevantan prethodni rezultat, potvrda i odmor kada postoji. Ključna napomena specifična za izvođenje, ako postoji, ima sažetak i jasan pristup punom tekstu.

Na jedan dodir: ceo trening, ostale serije, istorija vežbe, puna napomena, tehnika/video, odmor, unapred odobrena alternativa.

U meniju: promena redosleda, dodavanje/uklanjanje vežbe, opšta zamena, kalkulatori, napredna podešavanja. Napredne opcije serije prikazati za aktivni/izabrani red, ne kao trajnu kolonu svakog reda ako to sužava unos.

RPE i RIR se ne brišu iz podataka i ne izjednačavaju automatski. Kratak prescription može biti „3 × 5–8 · RIR 2–3”; puni RPE, RIR i tempo ostaju u detaljima. Ako program naglašava tempo, on ostaje vidljiv. Ne koristiti automatsko sažimanje slobodnih beleški koje bi moglo izostaviti važan uslov izvođenja.

### 6.2. Fokusirani ekran

Ilustrativni wireframe, bez stvarnih podataka korisnika:

```text
‹  Trening A                       Završi
18:42 · 4/16 radnih grupa       Sačuvano
[ Pregled treninga · vežba 2 od 6       ]

Barbell Bench Press                    ⋯
3 × 6–10 · RIR 2–3          [ Uputstvo ]

Serija    kg          pon.          stanje
1         50          10              ✓
2        [50]         [ 8]      [ Potvrdi ]
3         —            —              ○
Prethodno, serija 2: 50 kg × 8 · datum
[ + Serija ]                [ Zagrevanje ]

[ Prethodna ]                    [ Sledeća ]
──────────────────────────────────────────
Odmor 01:12       [ +15 s ]    [ Preskoči ]
Sledeće: ova vežba · serija 3
```

Ovo je opis hijerarhije, ne zahtev da tekstualna tabela stane u svaki font. Na 360 px koristiti kratak vidljiv check button i puni pristupačni naziv; jedinice u zaglavlju ili labelama. Za uski prikaz istorija ide u jednu liniju ispod aktivnog reda, ne u dodatnu obaveznu kolonu. Od 480 px može se dodati kolona „Prethodno” ako stvarno ostaje prostor za mete od 48 px.

Fokusirani ekran prikazuje sve serije trenutne vežbe kada je kratak spisak. Za mnogo serija prikaže aktivnu i susedne uz „Sve serije (n)”. Ne uvoditi više skrolujućih kontejnera u glavnom ekranu. Duge napomene i velike tabele imaju prirodan skrol ili sheet. Ne nametati fiksnu visinu koja seče sadržaj.

Gornji header: kompaktan naziv treninga, vreme i napredak; puni naziv dostupan u pregledu. „Završi” je sekundarna radnja tokom rada, a postaje glavna kada nema preostalih planiranih serija. Discard prebaciti u meni. Brojač vremena ne sme ponovo renderovati svaki editor na svakom tick-u.

### 6.3. Pregled i navigacija

„Pregled treninga” otvara postojeću BottomSheet osnovu sa stavkama visine približno 56–72 px: naziv do dva reda, status i završene/planirane radne grupe. Superset je jedan roditeljski blok sa članovima i krugovima. Zagrevanje je odvojeno obeleženo. Izbor stavke zatvara sheet i aktivira njen sledeći nezavršen red.

Ne oslanjati se isključivo na swipe. Postoje vidljive radnje Prethodna/Sledeća i pregled. Pregled je jedan dodir, skok na proizvoljnu vežbu dva. Ručni prelazak ne označava ništa završenim i ne menja planirani redosled. Povratak na trening vraća izabranu vežbu/seriju, ne početak liste.

Za straight vežbu: potvrda ostaje na istoj vežbi i aktivira sledeću radnu seriju; posle poslednje ponudi jasno „Sledeća vežba”. Automatski prelazak između straight vežbi nije potreban u prvoj verziji. Za superset automatski prelazak unutar bloka jeste podrazumevan nakon uspešnog upisa, uz ručni override.

Trajno čuvanje izabranog fokusa je lokalno UI stanje, vezano za korisnika i sesiju. Ne uvoditi server kolone samo za otvoreni panel. Ne koristiti lokalni UI state kao jedino mesto za stvarne vrednosti treninga. Nakon brisanja sesije/logout-a očistiti pripadajuće preference i draftove; ne prikazivati prethodnom nalogu podatke drugog korisnika.

### 6.4. Brz, nedvosmislen unos

Svako polje ima vidljivu jedinicu/oznaku i pristupačan naziv koji uključuje vežbu, seriju i, kada postoji, stranu. Placeholder služi kao primer formata, ne kao jedini prikaz podatka koji će biti upisan.

Razdvojiti tri pojma:

1. **Plan:** npr. 5–8 ponavljanja; nije rezultat.
2. **Prethodno:** stvarno završena, odgovarajuća serija iz istorije.
3. **Sada:** editabilna konkretna vrednost koja će biti zabeležena pri potvrdi.

Pripremljene vrednosti mogu stajati u inputima kao predlog uz oznaku izvora, ali ne smeju postati završene pre eksplicitnog dodira potvrde. Korisnik mora moći da ih izmeni ili očisti. Ako je cilj opseg, ne pretvarati „5–8” u proizvoljno „8”. Bez pouzdanog prethodnog rezultata polje ponavljanja ostaje prazno. Jedna potvrda može prihvatiti jasno prikazan predlog, bez dodatnog modala.

Redosled izvora, zasebno po polju:

- Sačuvan unos te serije / korisnikova izmena uvek ima prednost.
- Eksplicitna ciljana težina iz trenutnog plana može pripremiti težinu, jasno označenu kao cilj; zamenska vežba je ne nasleđuje.
- Odgovarajuća završena serija iz prethodne sesije, uparena po identitetu vežbe, vrsti serije, radnom ordinalu, strani, smeru i merenju.
- „Ponovi prethodnu seriju” je eksplicitna prečica iz tekućeg treninga. Ne kopirati težinu sledećoj seriji automatski kada postoji drugačiji propisan cilj.
- Ako nema pouzdanog izvora: prazno polje sa labelom i kratkim objašnjenjem, bez izmišljenih vrednosti.

Podrazumevani istorijski kriterijum u prvoj verziji ostaje poslednja završena sesija za kompatibilnu vežbu. Filter „ista rutina” je kasniji dodatak; fallback mora biti vidljivo obeležen. ID ima prednost nad imenom; isto ime custom/system vežbe nije dovoljan dokaz istog opterećenja. Kod starih podataka bez pouzdanog tipa zagrevanja ne zaključivati po težini; pokazati istoriju bez automatskog uparivanja kada je nejasno.

Potvrda: proveri draft → napravi konačni validirani `SetRow` → sačekaj lokalni store commit → pokaži ✓ → izračunaj sledeći korak i odmor. Ne čekati mrežni sync. U slučaju neuspelog lokalnog upisa zadržati unos i fokus, objasniti grešku i ponuditi ponovni pokušaj. Isti set ID mora ostati isti pri ponovnom pokušaju.

Debounce ili coalescing upisa, ako se uvede, ne sme izgubiti poslednji znak kada korisnik odmah potvrdi ili napusti polje. Finalizacija mora koristiti trenutni draft, ne zastareli React prop. Operacije nad istom sesijom moraju sačuvati redosled ili se transakciono spojiti; reprodukovati rapid-typing/double-tap scenario pre promene store arhitekture.

Validacija po merenju:

| Measurement | Potrebne vrednosti za normalnu potvrdu | Poseban slučaj |
| --- | --- | --- |
| `weight_reps` | Eksplicitna težina ili BW i ceo broj ponavljanja > 0 | Nula opterećenja može biti validna; null nije automatski nula. Sačuvati postojeću BW/dodatno opterećenje semantiku. |
| `reps` | Ceo broj > 0 | Ne zaokruživati neprimetno `8.5` u 9. |
| `duration` | Trajanje > 0 | Vreme može doći iz tajmera, ali završetak tajmera nije automatski potvrda izvedene serije. |
| `distance_duration` | Distanca > 0 i trajanje > 0 | Ako se želi delimičan zapis, ponuditi zasebno eksplicitno „Sačuvaj nepotpun podatak”; ne označavati ga kao pun bez objašnjenja. |
| `weight_duration` | Eksplicitno opterećenje/BW i trajanje > 0 | Sačuvati canonical kg/s. |
| `weight_distance` | Eksplicitno opterećenje/BW i distanca > 0 | Sačuvati canonical kg/m. |

Predlog validacije je nova odluka proizvoda; proveriti kompatibilnost sa postojećim unosima. Nula ponavljanja za neuspešan pokušaj ne treba da bude prećutno odbačena niti protumačena kao regularno završena serija: eventualno kasnije dodati eksplicitno evidentiranje pokušaja. Istorijske redove sa null/0 ne prepravljati automatski.

`inputMode="decimal"` za opterećenje, numeric za ponavljanja; podržati zarez i tačku, ostaviti korisniku prelazno stanje kao `82,` tokom kucanja. Native tastatura u prvoj verziji. Sopstvena numerička tastatura je odložena jer donosi veliki trošak za accessibility, selekciju, paste, decimalne separatore i različite uređaje.

### 6.5. Potvrda, izmena i Undo

Završena serija je označena tekstom/ikonom i sažetim vrednostima. Dodir na rezultat otvara uređivanje. Dugme za potvrdu ne treba da postane neobjašnjivo „X”; za poništavanje koristiti eksplicitnu radnju ili pristupačno jasno imenovan toggle.

Posle potvrde ponuditi Undo oko 8 sekundi, ali poništavanje mora ostati dostupno i kasnije u detaljima serije. Undo vraća prethodnu verziju istog reda i ne stvara novi set. Za radnju sa greškom ne prikazivati poruku „sačuvano”.

Timer treba vezati za izvorni set/krug: Undo može otkazati odmor koji je upravo ta potvrda pokrenula, ali ne sme zaustaviti kasnije ručno pokrenut timer. Undo stare serije ne preusmerava korisnika automatski i ne oduzima fokus iz aktivnog unosa.

### 6.6. Superseti, krugovi, leve/desne strane

```text
Superset · krug 2/3                 Pregled
[ A1 Bench ] [ A2 Row ]
A1: završeno ✓          A2: sada

Machine Row
Cilj 8–12 · prethodno 60 kg × 10
kg [60]       pon. [10]       [ Potvrdi ]

Posle ove stanice: odmor 90 s
```

Navigaciju i odmor izvoditi iz strukturiranih podataka, ne parsirati engleske notes. U pregledanom primeru slobodna napomena opisuje i kraću pauzu između partnera, dok strukturirani blok daje odmor posle kruga. Prva verzija zadržava postojeću strukturiranu semantiku i prikazuje napomenu. Podrška za pauzu između stanica je poseban kasniji model/tiket, ne skrivena pretpostavka.

Pravila resolvera:

- Redosled je `session_blocks` + sortirane vežbe i serije; postojeće legacy supersete uključiti preko sadašnjih helpera, ne ignorisati ih.
- Radna jedinica je grupa istog `round_index`, a ne svaki levi/desni red posebno. Prikaz može reći „serija 2, leva/desna” uz jasno vidljive pojedinačne rezultate.
- Kod per-side/per-leg unosa prvo završiti zahtevane strane/smerove te stanice, pa preći na partnera.
- Ne označavati desnu stranu završenom samo zato što je korisnik uneo levu. Prečica „iste vrednosti” može kopirati draft, uz eksplicitnu potvrdu svake strane ili jasno imenovane grupne radnje.
- Odmor posle kruga počinje tek kada postojeći `isSetGroupComplete` i `isBlockRoundComplete` uslovi to dozvole; proširiti testove za nepotpune, dodatne i nejednake serije.
- Potvrda starije serije ne skače unapred dok korisnik uređuje istoriju tekućeg treninga.
- Ručno izabrana stanica poštuje se do naredne namerne radnje; sync u pozadini ne preuzima fokus.
- Za nejednak broj serija neke vežbe ne pripadaju kasnijim krugovima. Resolver ne sme da zaglavi, kreira dodatne setove ili startuje odmor dva puta.
- Warm-up grupa ima zaseban tok. Ne puštati je da pomeri redni broj radne serije partnera.
- Interval blok zadržava postojeći interval timer kao vlasnika work/rest faze; nema drugog automatskog rest tajmera.

### 6.7. Odmor i ekran sa tastaturom

Jedan dock upravlja odmorom i prikazuje „Sledeće”. Kada odmor radi: vreme, +15 s, Preskoči; izmena ukupnog vremena na dodir. Kada je završen: nenametljivo „Odmor završen”, bez blokiranja. Ne skakati na drugi ekran i ne završavati set automatski.

Dock ne dodaje prostor za `--bottom-nav-h` na workout ruti. Layout mora rezervisati njegovu stvarnu visinu i safe area. Kada je tastatura otvorena, vidljivi su aktivni input, identitet serije i potvrda; sekundarne informacije mogu izaći iz viewporta. Ne obećavati da ceo ekran i tastatura staju bez skrola.

Za tastaturu prvo koristiti normalan responsive layout, `dvh` i odgovarajući scroll padding. `VisualViewport` može biti progresivno unapređenje za poziciju docka; njegova visina nije sama po sebi siguran signal tastature zbog zoom-a i browser chrome-a. Potrebno je testiranje na uređaju. [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Postojeći rest timer već koristi deadline timestamp; zadržati ovaj princip. Native Android alarm, servis u pozadini ili tačno buđenje zaključanog uređaja nisu garantovani PWA funkcionalnošću. Testirati povratak iz pozadine, odbijenu dozvolu i ukinut wake lock; ne obećavati pouzdan alarm dok browser nije aktivan bez posebne platformske validacije.

### 6.8. Završetak treninga

Prvi sadržaj finish sheeta treba da bude sažetak: završene/preostale radne grupe, zagrevanje, trajanje i eventualno nezabeležene vrednosti. Beleške i session RPE mogu biti sklopljene opcije. Nedovršene serije ponuditi kao „Vrati se na sledeću” i „Završi sa unetim serijama”, bez automatskog dopunjavanja.

Za praznu sesiju postojeći kod već ima `window.confirm`; ne tvrditi da zaštita ne postoji. Zameniti ga doslednim in-app prikazom sa jasnim izborom. Discard ostaje posebna radnja i potvrđuje šta se gubi.

Neuobičajeno trajanje samo označiti za proveru. Mogući predlog kraja prema poslednjoj završenoj seriji ne primenjivati bez izbora korisnika i ne isključivati stvarni kasniji cardio/odmor. Korekcija trajanja i politika statistike zahtevaju zaseban tiket i proveru modela.

Predlog povećanja opterećenja treba prikazati kao konkretno „šta će se promeniti sledeći put”, sa jasnom mogućnošću odbijanja. Ne menjati kanonske podatke ili trenažnu logiku samo radi kompaktnijeg ekrana.

## 7. Review ostalih delova aplikacije

| Deo | Zadržati | Unaprediti | Provera uspeha |
| --- | --- | --- | --- |
| Today | Jednu jasnu glavnu radnju i sklopljene check-in kartice | Kraći pozdrav/statistika, mali prikaz sledećeg treninga, kompaktno prazno stanje; ne prikazivati dva jednako dominantna Resume-a | Glavna radnja bez skrola na 360 px; prvi check-in dostupan bez prekrivanja |
| Globalna navigacija | Today / Plan / Progress i podnavigaciju | Resume kao rezervisana traka iznad donje navigacije, ili sakriven dok je glavni Resume u vidnom polju; neutralniji status „Sačuvano” umesto neodređenog „Success” | Nema prekrivenog fokusiranog elementa ni poslednjeg reda |
| Calendar | Mesec i jasnu semantiku statusa | Opcioni „Nedelja / Mesec” ili agenda za dnevno planiranje; sažetak izabranog dana, legende bez dominacije | Današnji plan i početak dostupni u ≤2 namerna dodira; ne dodavati kalendarski workflow korisniku koji prati rotaciju |
| Routines / StarterPreview | Gotove programe i odvojene custom rutine | Aktivni plan i sledeći trening prvi; starteri sklopljeni; dosledno objasniti plan naspram rutine; ne duplirati već dodati New plan | Korisnik razlikuje „pokreni”, „uredi” i „dodaj program” bez probanja |
| PlanEditor | Redosled rutina | Sažetak kao ulaz pre editora, Save dostupan, notes po potrebi sklopljene, vidljivo stanje izmena | Sačuvaj dostupno bez traženja dna; odlazak ne odbacuje neprimetno draft |
| RoutineEditor | Sklopljene stavke i postojeću prescription logiku | Puni naziv ima prioritet nad ikonama; grupisani blokovi; osnovna polja prvo, advanced sekcije kasnije; zajedničke izmene odmor/RIR tek nakon MVP-a | Nijedan naziv ne nestaje na 360/390 px; isti prikaz pri dugom srpskom tekstu |
| Exercises / ExercisePicker | Lokalnu pretragu i kategorije | „Nedavno” iz postojeće istorije; oprema/mišić filteri u panelu; bibliotečki linkovi u detaljima; sugestije zamene prvo | Česta vežba dostupna bez pregledanja cele abecedne liste; stanje pretrage se ne gubi pri povratku |
| History | Grupisanje po datumu | Pretraga naziva, period i rutina; datum/naziv/sažetak u stabilnim redovima; razlikovati kompletan i delimičan trening | Bitne metrike ne završavaju ellipsis-om; povratak čuva list position |
| HistoryDetail | Snapshot koji ne menja rutinu | Read-only sažetak prvo, eksplicitno „Uredi”, kompaktniji prikaz setova; deljenje editora sa Workout bez deljenja aktivnog timera | Izmena istorije ne pokreće odmor, navigaciju treninga ni promenu šablona |
| Progress | Trendove, rekorde i vremenski filter | Primarno Snaga / Kondicija / Telo; fokus na pitanje i izabranu vežbu; nekoliko metrika, trend, detalji; ukloniti podrazumevane mešane skale iz istog grafikona ili ih veoma jasno odvojiti | Relevantan trend u prvom ekranu; prikaz „nema podataka” ne izgleda kao nula |
| Settings | Accordion sažetke | Prepoznatljive jezičke/tematske vrednosti; training UX opcije zajedno; backup/import u Data; vidljiv rezultat akcije | Ključna preferenca na ≤2–3 dodira, bez nove dugačke forme |
| Auth / onboarding | Jednostavan auth gate | Kratko objašnjenje email linka, recovery i offline dostupnosti; setup jezika/jedinica, zatim izbor programa; instalaciju PWA ponuditi u prikladnom trenutku | Novi korisnik stiže do prve rutine bez podešavanja naprednih opcija; proveriti zasebno u test nalogu |
| Coach / klijent | Capability-based ograničenja | Prioritet „zahteva pažnju”, sažeci i sekcije; razlika između propisanog i korisnički izmenjenog treninga | Restrukturisanje ostaje nedostupno kada capability ne dozvoljava; proveriti obe uloge |
| Cardio / mobility / tendon | Measurement-driven input i intervale | Fokus na odgovarajuću meru; strana/smer/tempo kada su relevantni; ne koristiti kg × reps šablon za sve | Svih šest measurement tipova radi u istom navigacionom toku |

Ovo je pregled kompletne strukture aplikacije, ali ne tvrdnja da su sve varijante svakog toka izvršene. Ekrane koji su pregledani samo kroz kod treba uključiti u naredni praktični audit.

## 8. Vizuelni sistem i pristupačnost

Sačuvati postojeću paletu i sistemske fontove. Smanjiti ponovljene bedževe, velika prazna stanja, stalne akcione redove i dekorativne obojene okvire. Samo aktivni blok dobija dominantan akcenat; završene i naredne vežbe su tiše. Boja ne sme biti jedini signal statusa.

Za web kontrole važi repo minimum od 44 CSS px; cilj za često korišćene mete je 48 CSS px. Android preporučuje 48 dp za native dodirne površine; dp i CSS px nisu identične merne jedinice. [Android smernice](https://developer.android.com/guide/topics/ui/accessibility/apps).

Osnovni tekst približno 16 px, sporedni 13–14 px; brojčani unos najmanje 16 px. Ne smanjivati tipografiju da bi se ispunio cilj visine. `font-variant-numeric: tabular-nums` za vreme i metrike. Dug naziv može u dva reda, a puni tekst dostupan bez hover-a.

Proveriti WCAG AA kontrast (normalan tekst 4,5:1, veliki 3:1 i relevantne kontrole 3:1), focus-visible, reflow, 200% text zoom, reduced motion i TalkBack. Sticky header/dock ne sme sakriti fokusirano polje; to je posebno relevantno za kriterijum Focus Not Obscured. [W3C objašnjenje](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Sheet: fokus ulazi u njega, ostaje u njemu i vraća se na trigger; pozadina nije interaktivna. Escape, dugme Zatvori i Android Back treba dosledno da zatvaraju najviši sloj. Sa HashRouter-om osmisliti kontrolisanu overlay-history integraciju bez dodavanja unosa pri svakom renderu; kada nema sloja, Back vraća prethodnu rutu i čuva sesiju. Ne presretati globalno svaki Back tako da aplikacija postane zamka.

Poruke o čuvanju i prelasku stanice idu kroz `aria-live="polite"`; timer ne izgovara svaku sekundu. Svako identično check dugme ima jedinstven kontekst, npr. „Zabeleži seriju 2 za Machine Row”.

## 9. Tehnička mapa za implementaciju

Svi putevi su relativni na koren Herkules repozitorijuma. Imena novih komponenti su predlog, ne zahtev za dodatnim apstrakcijama ako postojeće komponente mogu jasno da se prošire.

| Postojeće mesto | Rad |
| --- | --- |
| `src/routes/Workout.tsx` | Razdvojiti orchestration treninga od prikaza kartice; aktivan exercise/set/block; pregled i finish flow; centralna reakcija na uspešno lokalno beleženje |
| `src/routes/workout.css` | Kompaktniji header, fokusirani blok, dock i prostor za njega; narrow keyboard state |
| `src/components/SetEditor.tsx` i `setEditor.css` | Draft, vidljive labele, priprema vrednosti, validacija, jedinstvena potvrda, pending/error/undo; ne pokvariti HistoryDetail |
| `src/lib/validation.ts` | Pure parsing/validation za finalnu potvrdu uz odvojeno prihvatanje prelaznih stringova dok se kuca |
| `src/lib/metrics.ts` | Uparivanje prethodnih setova sa dokazivim identitetom i source metadata; sačuvati postojeće ostale metrike |
| `src/lib/prescription.ts` | Proširiti/reuse pravila grupa i krugova; ne duplirati side/direction logiku u React-u |
| `src/lib/workoutFlow.ts` + colocated test, ako opravdano | Čist resolver sledeće radne jedinice i napretka; nema I/O, timera ni Supabase poziva |
| `src/lib/store.tsx` | Upisi ostaju ovde; potvrda/Undo koriste isti put; proveriti ordering/coalescing i lokalni error contract |
| `src/lib/restTimer.ts`, `intervalTimer.ts`, `notifications.ts`, `wakeLock.ts` | Sačuvati timestamp princip; vezati timer za izvor, sprečiti konflikt intervala i odmora; feature detection |
| `src/components/ui.tsx` | Reuse i po potrebi doraditi postojeći BottomSheet/Modal; fokus, background inertness, Back i keyboard layout |
| `src/components/AppLayout.tsx`, `PrimaryWorkoutAction.tsx`, `appLayout.css` | Resume bez zaklanjanja, razumljiv status čuvanja |
| `src/styles/theme.css`, `global.css` | Touch targets i mali skup spacing pravila, bez globalnog smanjivanja `.btn` |
| `src/lib/i18n/en.ts`, `sr.ts` | Sve nove vidljive poruke, aria-label i tooltip; EN source of truth, SR Latin |
| `src/routes/Today.tsx`, `Progress.tsx`, `History.tsx`, editori i pripadajući CSS | Kasniji paketi iz tabele u odeljku 7 |
| `src/types/db.ts`, postojeće migracije | Samo pregled kompatibilnosti za MVP; ne uvoditi novu server šemu za layout/fokus |

Predloženi rezultat čistog resolvera: identitet trenutne grupe, sledeći exercise/set ID, broj završenih/planiranih radnih grupa, eventualni rest intent sa source ID i objašnjenjem. Resolver vraća podatke; komponenta ih prikazuje i izvršava dozvoljenu navigaciju. Testirati iz snapshot-a pre/posle potvrde, umesto oslanjanja na trenutno stanje DOM-a.

SessionDoc ostaje jedini izvor workout podataka. Nema direktnih Supabase poziva iz komponenti, drugog outbox-a ili paralelnog workout store-a. Lokalno preference stanje ne sme zaobići IndexedDB persistence stvarnih unosa. Canonical kg/meters/seconds ostaju nepromenjeni; istorija i export ne prevode nazive/podatke.

MVP ne zahteva novu tabelu. Ako kasniji rad uvede sync preferenci, eksplicitni skipped status, korekciju trajanja koja nema postojeće polje ili pauzu između stanica, to je zaseban pregled modela: tipovi, kompatibilnost, migracija, RLS i test projekat. Ne koristiti `completed_at` da bi se predstavljalo „preskočeno”.

## 10. Redosled isporuke i konkretni radni paketi

Veličina S/M/L je relativan obim, ne procena trajanja rada agenta. Svaki paket treba da ostavi aplikaciju upotrebljivom. Završni commit/push pratiti prema važećem AGENTS.md; ne završavati veliki paket sa polufunkcionalnim novim ekranom.

| Paket | Prioritet / obim | Sadržaj | Zavisnost | Uslov završetka |
| --- | --- | --- | --- | --- |
| UX-00 | P0 / S | Anonimni fixture, početna merenja, reprodukcija W01/W06, provera trenutne verzije | Nema | Poznat baseline i zapis koji nalazi još postoje |
| UX-01 | P0 / L | Validiran finalni draft, prethodni podaci po semantici, lokalni save/error, dupli tap i testovi | UX-00 | Prazna serija ne prolazi kao regularna; tačan podatak upisan jednom |
| UX-02 | P1 / M | Kompaktna kartica, kratko sklopljeno stanje, labele, 48 px mete, menu akcije | UX-00; integracija sa UX-01 | Ista funkcionalnost, manje overhead-a, bez nestalih naziva i bez promenjene semantike podataka |
| UX-03 | P1 / L | Resolver aktivne grupe, fokusirani prikaz i pregled treninga, čuvanje izabranog fokusa | UX-01, UX-02 | Aktivni unos dostupan bez ručnog traženja; proizvoljna vežba u dva dodira |
| UX-04 | P1 / L | Superseti/circuits, side/direction, napredak grupa, timer source i Undo | UX-03 | Ceo A1/A2 tok bez navigacionog skrola; nema ranog ili duplog odmora |
| UX-05 | P1 / M | Keyboard/dock/Back, status sačuvano/offline, finish sažetak | UX-03, UX-04 | Uređaj test matrica prolazi, nema gubitka drafta ili zaklonjenog unosa |
| UX-06 | P1 / M | Globalni Resume, editor naziv/Save, dijagnoza trajanja kao zaseban podzadatak | UX-02 | Nema preklapanja na 360 px; uzrok trajanja dokumentovan pre korekcije |
| UX-07 | P2 / M–L | Today, History i Progress hijerarhija | Stabilan workout MVP | Najčešća pitanja dostupna pre sekundarnih detalja |
| UX-08 | P2 / M | Picker nedavno/filteri, Calendar agenda, onboarding i role audit | UX-07 po potrebi | Dosledni mobilni tokovi i eksplicitno odrađene ranije neproverene varijante |

MVP za najveći efekat: UX-00 do UX-05. Ako je budžet manji, prvo UX-01 + UX-02 i popravka globalnog preklapanja/nestalog naziva iz UX-06. Vizuelni polish van workout-a dolazi posle toga.

Prilikom prelaska čuvati postojeći pregled cele sesije kao dostupnu alternativu dok fokusirani tok ne prođe testove. To je drugi prikaz istih podataka, ne drugi model. Kada oba postoje, koriste istu potvrdu i validaciju. Ne prikazivati korisniku interni feature-flag ili tehničke termine.

## 11. Merljivi ciljevi i test prihvatanja

Sledeće vrednosti su **ciljevi za testiranje**, ne već postignuti rezultati.

| Scenario | Cilj |
| --- | --- |
| Standardna vežba sa tri radne serije, 390 × 844, bez tastature | Naziv, cilj, sva tri reda, potvrda i odmor u raspoloživom ekranu; fokus sadržaj približno ≤680 CSS px, ako font i naziv to dozvole |
| Isti scenario, 360 × 800 | Aktivni red i njegov kontekst bez horizontalnog skrola; fleksibilna visina i pristupačnost imaju prednost nad 680 px ciljem |
| Šest vežbi u kompaktnom alternativnom pregledu | Cilj ≥50% niža visina dokumenta od odgovarajućeg baseline-a od oko 3.8k px, uz iste podatke, font i viewport |
| Standardan unos sa već pripremljenim validnim vrednostima | Jedan nameran dodir za potvrdu; bez dodatnog modala |
| Tri kruga A1/A2 | Nula ručnih vertikalnih pomeranja radi pronalaženja partnera; unos i dalje zahteva stvarne potvrde |
| Skok na proizvoljnu vežbu | Pregled + izbor = dva dodira |
| Unos sa otvorenom tastaturom | Aktivno polje i potvrda dostupni; nema zaklanjanja niti layout skoka koji gubi fokus |
| Lokalna potvrda | Brz vizuelni odgovor; zabeležiti medijanu/p95 lokalnog commit-a na test uređaju, cilj p95 <300 ms za standardni fixture bez čekanja mreže |
| Pouzdanost | Nula izgubljenih znakova, duplih setova i pogrešno prihvaćenih praznih vrednosti u test matrici |

Vreme zadatka meriti od početka interakcije sa telefonom do uspešnog lokalnog čuvanja, bez stvarnog vremena izvođenja vežbe/odmora. Broj skrolova meriti samo za navigaciju, odvojeno od skrola radi namernog čitanja istorije ili uputstva. Ne optimizovati samo visinu dokumenta na štetu broja dodira i jasnoće.

### Obavezni automatizovani slučajevi

- Parser: tačka/zarez, prazno, nula/BW, negativno, NaN, decimalna ponavljanja, trajanje, metric/imperial i promena jedinica.
- Suggestions: working vs warm-up, levi/desni, pronation/supination, backup vežba, razlika u broju serija, legacy bez metadata, isto ime/dva ID-a, nema istorije.
- Flow: straight; A1/A2; circuit sa tri stanice; nejednaki krugovi; vanredna/add set; ručno izabran red; edit završene serije; Undo; uklanjanje/swap uz postojeće capability zabrane.
- Persistence: poslednji ukucani znak + odmah potvrda; dupli tap; dve uzastopne izmene; lokalni upis neuspešan; reload/resume; promena session ID-a; logout/login drugog naloga.
- Timer: pokretanje samo jednom; ne pre završetka grupe; Undo odgovarajućeg izvora; interval/rest međusobno isključivanje; povratak iz pozadine računa iz deadline-a.
- Regresija HistoryDetail: izmena završene istorije ne pokreće active workout tok. Postojeći import/export i plan snapshots ostaju kompatibilni.
- i18n: EN/SR ključevi, dugi prevodi, kanonski podaci ostaju isti.

### Ručna Android matrica

Chrome u browseru i instalirana PWA; jedan manji uređaj oko 360 CSS px i jedan oko 412 px. Dodatno responsive provera 390, 768 i 1024 px. Najmanje Gboard decimal/numeric i jedna druga tastatura ako je dostupna. Testirati:

1. Unos jednom rukom, promena težine/reps, backspace/paste i immediate confirm.
2. Otvorena tastatura, Android Back, otvoren sheet, povratak iz druge aplikacije.
3. Airplane mode nakon učitavanja, lokalna potvrda, reload, povratak mreže i isti setovi nakon sync-a.
4. Zaključavanje ekrana i povratak; dozvole za notifications odbijene; wake lock ukinut.
5. Light/dark/system, EN/SR Latin, text scaling 200%, TalkBack i reduced motion.
6. Trenutna sesija nastavljena posle zatvaranja; proveriti šta je stvarno trajno čuvano, a šta je sessionStorage UI stanje.
7. Svih šest measurement tipova, zagrevanje, unilateralne i dvosmerne serije, superset/circuit/interval.
8. Dugački nazivi, veoma veliki brojevi, mnogo serija, bez istorije, samo BW, alternativna vežba i nalog sa ograničenim capability-jima.

Pokrenuti `npm run lint`, `npm test`, `npm run build`. E2E/RLS se pokreću samo ako postoji `.env.test.local`, prema AGENTS.md i SETUP.md; koristiti TEST projekat, nikada produkcioni nalog za sintetičke upise. Kada okruženje nije dostupno, jasno navesti da E2E nije izvršen; responsive pregled nije zamena za offline/device test.

### Kratak test sa korisnicima

Sa 3–5 ljudi koji zaista beleže treninge uporediti postojeći i predloženi tok sa istim sintetičkim treningom, uz promenjen redosled A/B da se umanji efekat učenja. Zadaci: tri obične serije, tri kruga superseta, promena redosleda zbog zauzete sprave, ispravka pogrešnog unosa, završetak delimičnog treninga. Meriti navigacione skrolove, dodire, vreme rukovanja, pogrešne potvrde i samostalno pronalaženje prethodnog rezultata. Mali uzorak daje kvalitativan smer, ne statistički dokaz.

## 12. Šta odložiti

- Native Android rewrite, Wear OS i logovanje iz notification-a: van ovog UI/UX MVP-a.
- Sopstvena tastatura, kompleksni swipe gestovi i haptic-only feedback.
- AI automatsko sažimanje trenažnih instrukcija ili određivanje opterećenja.
- Novi charting framework, globalna zamena design system-a ili celog store-a.
- Novi model za skipped set, između-stanica odmor i cross-device preference dok se ne utvrdi konkretna potreba.
- Masovno „popravljanje” istorijskih trajanja, warm-up oznaka ili dupliranih vežbi bez provere porekla.
- Beskrajna personalizacija gustine. Prvo jedan dobar default i dostupnost, zatim preference zasnovane na rezultatima testova.

## 13. Tekst koji se može direktno predati sledećem AI agentu

> Radi u Herkules repozitorijumu. Prvo pročitaj AGENTS.md, SETUP.md i `docs/ui-ux-review-and-implementation-plan.md`. Cilj je brži i pouzdaniji mobilni unos treninga sa manje navigacionog skrolovanja. Počni proverom nalaza na aktuelnom commitu i paketom UX-00, zatim sprovedi UX-01 i UX-02; nastavi kroz UX-03–UX-05 za kompletan workout MVP. Zadrži offline-first upise kroz useStore, canonical jedinice, session snapshots, capability ograničenja i EN/SR Latin i18n. Pripremljene vrednosti moraju biti vidljive i razlikovati se od plana; zabranjena je neprimetna potvrda praznih setova. Uvedi fokus trenutne vežbe/bloka, pregled svih vežbi i semantički ispravan superset/side/direction tok. Sačuvaj postojeće intervalne tajmere i spreči dupli rest. Koristi postojeći BottomSheet i SetEditor kada je moguće, a čistu navigacionu logiku izdvoji samo ako je opravdano. Ne menjaj šemu za UI stanje. Ne testiraj upise na produkcionom nalogu. Svaki paket završi odgovarajućim unit proverama i lint/build proverama, a E2E/RLS samo uz .env.test.local. Stvarni Android keyboard/offline test i neizvršene provere jasno prijavi. Prati Git pravila iz AGENTS.md. U završnom izveštaju navedi završene pakete, merenja pre/posle, preostale rizike i linkove na izmene.

Za kompletno unapređenje ostatka aplikacije posle stabilnog workout MVP-a nastaviti UX-06–UX-08. Ovaj dokument je samostalan; njegovu implementaciju ne treba usloviti dostupnošću pratećeg konceptualnog prikaza u razgovoru.
