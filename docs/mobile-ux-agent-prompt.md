# Prompt za AI agenta — Herkules mobilni UI/UX

Kopiraj sadržaj od sledećeg odeljka do kraja dokumenta u novi razgovor agenta koji ima pristup repozitorijumu. Prompt je napisan za implementaciju; audit i plan su već završeni. Korisnik je kao pravac izabrao **„Fokus na vežbi”**.

---

## Tvoj zadatak

Radi kao senior frontend inženjer i product designer u postojećoj Herkules aplikaciji. Implementiraj unapređenja mobilnog UI/UX-a iz `docs/ui-ux-review-and-implementation-plan.md`, vodeći se detaljnim zahtevima u ovom promptu.

Repozitorijum je `/Users/milosivanovic/GIT/Herkules`. Ako radiš u drugom checkout-u, koristi njegov stvarni koren i iste relativne putanje. Produkcija je `https://mlsivanovic.github.io/Herkules/`. Ovo je offline-first React/TypeScript PWA, ne zadatak za novu native Android aplikaciju.

Najvažniji ishod: korisnik tokom treninga brzo vidi šta radi, šta je radio prošli put, koje vrednosti beleži sada i šta sledi, uz što manje ručnog navigacionog skrolovanja. Sačuvaj korisne informacije, čitljivost i pouzdanost podataka.

**Izabrani pravac je fokusirani prikaz trenutne vežbe, odnosno trenutne stanice superseta/circuit-a, sa kompaktnim pregledom celog treninga.** Nemoj ponovo birati između dizajnerskih pravaca niti praviti samo statičan mockup. Isporuči funkcionalne izmene u postojećoj aplikaciji, sa odgovarajućim testovima i proverom.

Radi u etapama. Najpre završi workout MVP, pakete UX-00–UX-05, zatim UX-06–UX-08 za ostatak aplikacije prema referentnom planu. Ne preskači pouzdanost unosa radi bržeg vizuelnog rezultata. Sporne poslovne odluke i zahteve koji stvarno traže nov model izdvoji i obrazloži; nemoj ih tiho pretpostaviti. Ne tvrdi da je ceo plan završen ako je urađen samo workout MVP.

## 1. Izvori, početak rada i prioriteti

Pre uređivanja pročitaj:

1. Važeći `AGENTS.md` i eventualne instrukcije u direktorijumima koje menjaš.
2. `SETUP.md`, naročito razlikovanje produkcionog i TEST okruženja.
3. `docs/ui-ux-review-and-implementation-plan.md` u celini.
4. Ovaj prompt u celini.
5. Aktuelni kod relevantnih komponenti, helpera i testova.

Audit je nastao 12. oktobra 2026. na početnom kodu `9063ef5`; dokumentacija je kasnije dopunjena. GitHub Pages prikaz pri auditu nije bio potvrđen kao isti commit. Proveri aktuelni `git status`, branch i verziju. Sačuvaj tuđe izmene; ne resetuj checkout i ne stage-uj nepovezane fajlove.

Za odluke o ponašanju primeni važeće korisničke/repozitorijumske instrukcije, zatim ovaj detaljniji prompt i referentni plan. Kod i testovi pokazuju postojeću semantiku koju treba sačuvati ako ovde nije izričito promenjena. Posebno poštuj pojašnjenje o jednostranim vežbama u odeljku 7. Ako postojeći test formalizuje upravo problem koji treba ispraviti, promeni ga uz obrazloženje umesto da slepo očuvaš grešku.

Prva isporuka u razgovoru treba kratko da kaže koje nalaze i fajlove prvo proveravaš. Zatim radi implementaciju; ne vraćaj korisniku još jedan opšti predlog umesto rada. Rutinske implementacione odluke rešavaj samostalno. Za stvarno nejasnu promenu značenja podataka postavi jedno konkretno pitanje i nastavi nezavisan rad.

Ne zavisi od prethodnog razgovora, privatnih screenshotova ili lokalnog HTML prototipa. Prototip je služio za izbor pravca i sadrži ilustrativne vrednosti, a ne specifikaciju persistence-a, timera ili semantike serija.

## 2. Granice koje se ne menjaju

- Mutacije idu preko `useStore()` i postojećeg offline store-a. IndexedDB prvo, postojeći idempotentni outbox, sync potom. Komponente ne pozivaju Supabase direktno.
- `SessionDoc` ostaje izvor istine za trening. Ne uvodi drugi workout store, drugi outbox ili kopiju server podataka radi novog prikaza.
- Kanonske jedinice su kg/meters/seconds. Metric/imperial konverzija je prikazna i koristi postojeće helpere.
- Aktivni trening, istorijski snapshot i rutina imaju različitu namenu. Izmena istorije ili tekuće sesije ne sme prećutno promeniti plan.
- Zadrži capability pravila za običan, ograničen i coach/client nalog. Skriveno dugme nije zamena za postojeća ograničenja u poslovnoj logici.
- Zadrži HashRouter, subpath `/Herkules/`, auth gate i workout van `AppLayout`.
- Zadrži light/dark/system teme i postojeće tokene. Nadogradi postojeće komponente pre uvođenja novih paralelnih varijanti.
- Sve vidljive UI poruke, aria-label i title idu kroz EN/SR Latin i18n. Nazivi vežbi i drugi kanonski podaci ostaju u izvornom obliku; komentari i commit poruke su na engleskom.
- Service worker kešira app shell, ne Supabase odgovore.
- UI fokus, otvoreni panel ili izabrani režim nisu razlog za novu server tabelu. Nove potrebe za modelom razmatraj odvojeno, sa tipovima, migracijom, RLS i kompatibilnošću kada su zaista potrebne.
- Ne uvodi nove velike zavisnosti, design system, charting framework, native omotač ili sopstvenu tastaturu bez konkretnog dokazanog razloga.
- Ne menjaj program treninga, target opterećenja, broj serija ili zdravstvene/trenažne preporuke da bi UI lakše stao na ekran.

## 3. Faza UX-00: potvrdi baseline

Napravi sintetički test scenario bez kopiranja privatne istorije korisnika: šest vežbi, tri obične radne serije na prvoj vežbi, par u supersetu, zagrevanje i mešoviti dodatni slučajevi. Za istoriju pripremi radne i warm-up setove, jednu vežbu bez istorije i poseban legacy fixture sa levim/desnim redovima.

Proveri ove nalaze na aktuelnom kodu pre popravke:

- Placeholder prethodne vrednosti nije stvaran unos, a check može potvrditi prazan `SetRow`.
- Kartice početno otvorene i sklopljene kartice i dalje visoke zbog sadržaja van `expanded` uslova.
- Predlog prethodne serije preko `previous[setIndex]` bez semantičkog uparivanja.
- Mali kontrolni elementi preko `.btn--small` i `.input--cell`.
- Pokretanje odmora pre završetka lokalnog `upsertSet` poziva.
- Odvojene velike superset kartice bez vođenja korisnika do partnera.
- Floating Resume zaklanja sadržaj; naziv vežbe u editoru može izgubiti raspoloživu širinu.

Početna merenja iz audita su približno 3.782 CSS px ukupne visine na 390 × 844, 534 px za prvu otvorenu karticu i 180 px za sklopljenu. Potvrda je bila visoka 36 px, input 40 px. To su tragovi za proveru, ne ciljevi koje treba reprodukovati po svaku cenu. Zapiši sopstveni baseline na istom fixture-u koji ćeš koristiti posle izmene.

Ne beleži probne serije u korisnikovu aktivnu produkcionu sesiju. Nemoj završiti, odbaciti, reorganizovati ili menjati produkcioni trening radi testiranja. Čitanje produkcionog UI-ja može pomoći proveri, ali upisi pripadaju odobrenom test okruženju.

## 4. Faze UX-01–UX-02: pouzdan unos i kompaktnost

### 4.1. Razlikuj plan, prethodno i sada

Plan „5–8 ponavljanja” nije zabeležen rezultat. Prethodno „50 kg × 8” je istorijska informacija. Sada su konkretne editabilne vrednosti koje će korisnik potvrditi.

Pripremljene vrednosti prikazuj u inputima sa kratkom oznakom izvora. Ne koristi placeholder da imitira već upisanu težinu. Prihvatljivo je da jedan dodir potvrde prihvati jasno prikazane pripremljene vrednosti; dodatni modal za svaku seriju nije potreban. Pre potvrde ništa nije završeno.

Prioritet izvora po polju:

1. Korisnikov sačuvani unos i tekući draft.
2. Eksplicitni cilj iz trenutnog plana za dato polje, ako je konkretna vrednost i važi za tu vežbu.
3. Pouzdano odgovarajuća prethodna završena serija.
4. Eksplicitna komanda „Ponovi prethodnu seriju” iz tekućeg treninga.
5. Prazno polje ako nema pouzdanog izvora.

Ne pretvaraj opseg u proizvoljan izvedeni broj. Ako prethodni rezultat izlazi iz sadašnjeg ciljnog opsega, zadrži jasnu razliku između istorije i plana; ne menjaj istoriju niti je predstavljaj kao trenutni cilj. Ne popunjavaj automatski vežbu-zamenu težinom primarne vežbe. Ne pretvaraj nepoznatu težinu u nulu.

Kod uparivanja koristi kompatibilan identitet vežbe/measurement, warm-up status, ordinal radne serije, postojeći round/side/direction. ID ima prednost nad imenom. Dve vežbe sa različitim ID-jevima i istim nazivom nisu automatski ista vežba. Legacy fallback dozvoli samo kada nije dvosmislen i kada korisniku možeš jasno pokazati izvor.

Ne zaključuj da je serija warm-up samo zato što ima manju težinu. Kada stari zapis nema dovoljno podataka, pokaži istoriju za referencu bez agresivnog automatskog uparivanja.

### 4.2. Validacija i čuvanje

Potvrda mora koristiti trenutni draft, uključujući poslednji ukucani znak. Redosled:

`draft → validacija → konačni SetRow → lokalni commit → potvrđen UI → sledeći korak/odmor`.

Ne čekaj mrežu da bi korisnik nastavio. Sa druge strane, nemoj prikazati uspeh i početi odmor ako je lokalni upis odbijen. Zadrži draft, pokaži razumljivu grešku i omogući ponovni pokušaj sa istim set ID-jem.

Spreči dupli tap na potvrdu dok traje lokalni commit. Ako se čuva tokom kucanja, finalna potvrda mora biti pravilno poređana sa tim upisima. Testiraj brze promene na istoj sesiji pre uvođenja eventualnog coalescing/queue rešenja; nemoj refaktorisati ceo store samo na osnovu pretpostavke.

Proveri svih šest measurement tipova. Za normalnu potvrdu zahtevaj potrebna polja prema tabeli iz plana. Podrži eksplicitno nulto opterećenje/BW gde je to postojeća semantika. Ponavljanja su ceo broj; ne pretvaraj neprimetno `8.5` u 9. Trajanje/distanca potrebni za izabrani measurement moraju biti validni i pozitivni.

Validaciju razlikuj od prelaznog stanja tokom kucanja: `82,` ili `82.` ne smeju izazvati skok kursora ili gubitak unosa. Podrži decimalni zarez i tačku; za druge parsere proveri postojeće pozivaoce i testove. Odbijena potvrda mora jasno objasniti polje koje treba ispraviti.

Ne prepravljaj istorijske null/0 zapise. Nova semantika neuspešnog pokušaja, nepotpunog merenja ili skipped seta zahteva eksplicitnu odluku; nemoj je lažno predstavljati preko `completed_at`.

### 4.3. Kompaktni elementi

Ukloni trajne redove za retke akcije iz glavnog toka. Naziv, cilj i unos imaju prioritet. Video, istorija, puna napomena, RPE/RIR/tempo detalji, zamena i kalkulatori ostaju dostupni kroz jasne kontrole.

Ne sakrivaj obavezno važnu instrukciju samo da bi kartica bila kraća. Pokaži kratak postojeći preview i otvaranje punog teksta; ne koristi AI prepričavanje slobodnih beleški.

Metapodaci i dugmad ne smeju istisnuti naziv vežbe. Na 360 px naziv može u dva reda. Sklopljena stavka sadrži naziv, status/napredak i najviše jednu sažetu liniju plana, okvirno 56–72 px kada sadržaj to dozvoli.

Česte dodirne mete ciljaju 48 × 48 CSS px; minimum iz repozitorijuma je 44 px. Manja vidljiva ikona može biti u većoj meti. Ne rešavaj gustinu smanjivanjem touch target-a ili osnovnog fonta.

## 5. Faza UX-03: funkcionalan fokusirani prikaz

Fokusirani prikaz je podrazumevan mobilni tok. Glavni sadržaj je jedna vežba/stanica, ne svih šest potpuno otvorenih kartica.

Obavezni elementi:

- Kompaktan header: naziv treninga, proteklo vreme, razumljiv napredak i sekundarno „Završi”. Discard u meniju.
- „Pregled treninga” dostupan jednim dodirom, sa brojem/pozicijom vežbe.
- Naziv vežbe, kratak plan, vidljive jedinice, konkretne vrednosti trenutnog unosa.
- Sve serije trenutne vežbe kada ih ima nekoliko; kod mnogo serija aktivna i relevantne susedne sa jasnim pristupom svim serijama.
- Prethodni rezultat odgovarajuće serije blizu unosa, sa izvorom/datumom gde je dostupan.
- Dodavanje serije i zagrevanja, uputstva i detalji bez gubitka postojećih funkcija.
- Ručni Prethodna/Sledeća ili jednako jasna navigacija bez obaveznog swipe-a.
- Odmor i sledeći korak kada su relevantni.

Na 360 px prethodni rezultat stavi u sažet red uz aktivnu seriju ako dodatna kolona sužava polja. Na širem ekranu kolona „Prethodno” je prihvatljiva ako ostaju čitljive vrednosti i dovoljno velike mete.

Pregled treninga otvori kroz postojeću BottomSheet osnovu. Prikaži sve vežbe, grupisane supersete/circuits i njihov napredak. Izbor vežbe zatvara sheet i pokazuje njen odgovarajući unos. Skok na proizvoljnu vežbu treba da bude „pregled + izbor”, dva dodira.

Ručni prelazak ne označava set završenim, ne menja redosled plana i ne odbacuje draft. Povratak na aktivni trening obnavlja izabranu vežbu/seriju ako još postoji. Lokalno UI stanje veži za korisnika i session ID i očisti ga na odgovarajućem logout/delete toku. Ako izbor više ne postoji, deterministički izaberi prvi nezavršen kompatibilan red, zatim prvi dostupni.

Kod straight vežbe posle potvrde aktiviraj sledeću seriju iste vežbe. Posle poslednje prikaži jasnu radnju za sledeću vežbu. Ne odvlači korisnika automatski dok proverava upravo upisan rezultat.

Sačuvaj dostupan pregled cele sesije tokom prelaska na novi tok, sa istim komponentama za validaciju i upis. To nije dozvola za paralelni model podataka. Desktop prikaz može koristiti više prostora, ali mora deliti ponašanje i semantiku sa mobilnim.

## 6. Faza UX-04: superset/circuit tok, napredak i Undo

Svi partneri pripadaju jednom jasno označenom bloku. Prikaži krug, aktivnu stanicu i sledeću stanicu. Primer: „Superset · krug 2/3”, A1 završena, A2 sada; posle A2 odmor.

Posle uspešne potvrde aktivnog reda pređi na sledeću potrebnu stanicu/grupu bez ručnog vertikalnog traženja partnera. Korisnik u svakom trenutku može ručno izabrati drugu vežbu. Sync u pozadini i izmena starog reda ne smeju sami preuzeti fokus.

Koristi postojeće strukturirane blokove i legacy superset helpere. Ne parsiraj slobodne notes da bi odredio tajmer. Ako notes pominju odmor između partnera, a model ima samo odmor posle kruga, zadrži postojeću strukturiranu semantiku i vidljiv tekst; to nije dozvola da izmisliš novi automatski timer.

Čist resolver toka treba da odgovori na: koja grupa je završena, koji postojeći set/vežba ide sledeći, da li je ceo krug gotov i da li treba odmor. Nema I/O ili poziva tajmera iz resolvera. Dodaj colocated testove za njegove odluke.

Pokrij nejednak broj serija partnera, dodatne setove, zagrevanje, prazne blokove, uklonjenu vežbu i ručni izbor van redosleda. Nijedan slučaj ne sme napraviti beskonačno preskakanje, dodatne setove bez korisnikove radnje ili dvostruki odmor.

Napredak razlikuje delimično i potpuno završenu vežbu. Zagrevanje ne ulazi neprimetno u broj radnih serija. Više side/direction redova jedne grupe ne predstavljaj kao više nezavisnih radnih serija bez oznake. U pregledu grupe koristi krugove; ne sabiraj krugove i pojedinačne setove kao istu jedinicu.

Undo vraća prethodno stanje istog reda. Kratko dostupna povratna radnja posle potvrde može trajati oko osam sekundi, ali naknadna izmena/poništavanje ostaje dostupno i posle toga. Ne koristi nejasan X kao jedini signal promene statusa.

Odmor veži za izvorni set/krug. Undo upravo te potvrde može otkazati njen odmor, ali ne sme zaustaviti kasnije ručno pokrenut ili drugi timer. Poništavanje starog seta ne sme automatski skočiti na drugi ekran.

## 7. Važna postojeća semantika: jednostrane vežbe

**Ne uvodi obavezno dvostruko logovanje leve i desne strane.** Aktuelni `materializePlannedSets` u `src/lib/prescription.ts` pravi jedan zajednički rezultat po per-side/per-leg grupi, sa `side: null`. Testovi to izričito potvrđuju. `side_mode` opisuje propisano izvođenje, ali sam po sebi ne znači da treba napraviti dva reda.

Ako postoje pronation/supination smerovi, postoje zasebni redovi po smeru; njih sačuvaj. Legacy snapshot može već imati posebne leve/desne redove: njih prikaži i sačekaj potvrdu svih potrebnih redova pre završetka grupe/odmora.

Zajednički rezultat ne pretvaraj u dva reda. Kod postojećih odvojenih redova potvrda levog ne potvrđuje desni. Eventualno kopiranje vrednosti nije isto što i potvrđivanje izvedene serije.

Ovo pravilo ima prednost nad generičkim tumačenjem da svaka unilateralna vežba zahteva odvojene potvrde obe strane.

## 8. Faza UX-05: tastatura, odmor, čuvanje i završetak

Koristi native tastaturu: decimal za težinu/distancu, numeric za ponavljanja i prikladan format za vreme. Tastatura ne sme sakriti aktivno polje, identitet serije i potvrdu. Ne zahtevaj da ceo trening stane iznad tastature; dozvoli razuman skrol i smanji sekundarni sadržaj.

Workout dock ne rezerviše prostor za bottom nav koji na toj ruti ne postoji. Rezerviši stvarnu visinu docka, safe area i odgovarajući scroll padding. Jedan glavni scrolling container; sheet može imati sopstveni skrol kada je sadržaj dug. Nemoj seći sadržaj fiksnom visinom.

`VisualViewport` koristi samo kao progresivno unapređenje ako je potrebno i testirano. Promena njegove visine nije automatski dokaz otvorene tastature. Zoom i browser chrome ne smeju pokvariti layout.

Zadrži timestamp/deadline princip rest timera. Interval timer ostaje vlasnik interval work/rest faze; nema konkurentnog automatskog rest tajmera. Tajmer ne završava set umesto korisnika. Nemoj obećavati native Android alarm u pozadini ako PWA to ne može pouzdano da pruži.

Pokaži razliku između „čuva se lokalno”, „sačuvano lokalno / čeka sync” i stvarne greške kada ti podaci postoje. Poruka ne sme tvrditi cloud uspeh samo zato što je lokalni upis uspeo. Status ne treba da uzima ceo red kada nema problema.

Finish sheet prvo pokazuje završene/preostale radne grupe, zagrevanje i trajanje, pa opcione beleške i session RPE. Omogući povratak na sledeću nezavršenu seriju ili eksplicitni završetak sa unetim podacima. Ne popunjavaj nedovršene setove automatski. Postojeći guard za praznu sesiju zameni doslednim in-app izborom, ne uklanjaj zaštitu.

Discard i uklanjanje vežbe sa podacima zahtevaju jasan opis posledice i prikladnu potvrdu. Promenu opterećenja za budući trening prikaži kao konkretnu promenu koju korisnik razume i može odbiti.

Neuobičajeno dugo trajanje prvo dijagnostikuj: uvoz, zaboravljen završetak, vremenske oznake ili drugi uzrok. Nemoj masovno prepisivati istoriju, automatski odseći trajanje na poslednju seriju ili ignorisati trajanje cardia posle poslednje strength serije. Ako ispravka zahteva novu poslovnu odluku, dokumentuj je kao odvojenu stavku.

## 9. UX-06–UX-08: ostatak aplikacije

Posle stabilnog workout toka primeni odeljak 7 referentnog plana. Minimalno po oblastima:

| Oblast | Zahtev |
| --- | --- |
| Globalna navigacija | Zadrži Today / Plan / Progress. Resume je dostupna radnja koja ne zaklanja kartice, inpute ni navigaciju. Ukloni istovremeno dominiranje dva Resume dugmeta na Today-u. |
| Today | Glavni početak/nastavak i sledeći trening visoko; manje praznog prostora; check-in sažeci ostaju sklopljeni i dostupni. Ne menjaj logiku planirane rotacije. |
| RoutineEditor / PlanEditor | Nazivi se ne gube pod bedževima; osnovna i napredna polja imaju jasan redosled; Save i stanje izmena su dostupni bez traženja dna; očuvaj draft pri navigaciji. |
| Routines / StarterPreview | Aktivni plan i sledeći trening imaju prioritet; objasni plan/rutinu; ne pravi drugu New plan radnju ako je prethodna izmena već rešila problem. |
| History / HistoryDetail | Čitljiv naziv/datum i red metrika, filteri/pretraga, očuvana pozicija povratka; detalj je prvo pregled, pa namerno uređivanje bez pokretanja active workout logike. |
| Progress | Relevantan trend i nekoliko ključnih metrika pre dugačkih detalja; razumljive sekcije za snagu/kondiciju/telo; jasno nedostajući podaci i različite skale. Ne izmišljaj nove metrike. |
| ExercisePicker / Exercises | Nedavno korišćene iz postojeće istorije, relevantne alternative i razumljivi filteri; detaljni linkovi ne opterećuju svaki red; ne spajaj custom/system vežbe po nazivu. |
| Calendar | Brz pregled dana i opcioni sažet nedeljni/agenda tok kada je smislen; sačuvaj mesec i statuse; ne nametni obavezno kalendarsko planiranje rotacionim programima. |
| Settings / onboarding | Sačuvaj sažete sekcije, jasno organizuj jezik/jedinice/training preference; put do prvog treninga bez previše podešavanja. |
| Coach / ograničeni nalozi | Praktično proveri capability varijante, jasnu razliku propisanog i izmenjenog i dostupnost podataka po ulozi; ne proširuj pristup radi lakšeg UI-ja. |

Ne širi obim na sve ideje označene kao odložene u referentnom planu. Ako pojedina stavka nema dovoljno definisanu semantiku ili okruženje, precizno izdvoji preostali posao i nastavi nezavisan deo. Vizuelna promena bez testirane upotrebljivosti nije sama po sebi završetak paketa.

## 10. Mapa koda i stil implementacije

Prvo razmotri postojeće fajlove:

- `src/routes/Workout.tsx`, `src/routes/workout.css`.
- `src/components/SetEditor.tsx`, `src/components/setEditor.css`.
- `src/lib/validation.ts`, `src/lib/metrics.ts`, `src/lib/prescription.ts` i njihove testove.
- `src/lib/store.tsx` i postojeće persistence/sync puteve.
- `src/lib/restTimer.ts`, `src/lib/intervalTimer.ts`, `src/lib/notifications.ts`, `src/lib/wakeLock.ts`.
- `src/components/ui.tsx`: već postoje `Modal`, `BottomSheet`, `NotesDisclosure`.
- `src/components/AppLayout.tsx`, `PrimaryWorkoutAction.tsx`, `appLayout.css`.
- `src/styles/theme.css`, `global.css`, `src/lib/i18n/en.ts`, `sr.ts`.
- Ostale rute i njihov lokalni CSS prema paketu koji radiš.

Čistu kompleksniju flow logiku smeš izdvojiti u `src/lib/workoutFlow.ts` uz `workoutFlow.test.ts`, ako to zaista poboljšava preglednost. Ne prepisuj ceo `Workout.tsx` bez potrebe i ne pravi apstrakcije samo radi zamišljene buduće upotrebe.

Zajednički `SetEditor` koristi se i u istoriji. Odvoji podržano uređivanje od active workout efekata. Jedinstveni parsing/validation ne sme značiti da svaka promena istorije pokrene timer ili navigaciju.

Proveri performanse merljivim razlogom: proteklo vreme ne treba da ponovo renderuje svaki editor svake sekunde; čuvanje ne treba da izgubi karakter ili blokira mrežu. Nemoj uvoditi memoization svuda ili menjati dependency strukturu bez dokaza problema.

## 11. Pristupačnost i izgled

- Normalan tekst približno 16 px; sekundarni približno 13–14 px; brojčani input najmanje 16 px. Reflow ima prednost nad strogim ograničenjem visine.
- Česte mete 48 px, repo minimum 44 px. Dugi EN/SR tekst ne sme da suzi interaktivnu metu.
- Puni naziv vežbe dostupan bez hover-a. Status je i tekst/ikona, ne samo boja.
- Neutralni okviri za većinu sadržaja; akcenat za aktivnu vežbu i glavnu radnju. Sačuvaj paletu i tokene aplikacije.
- Testiraj light/dark/system, kontrast, 200% text scaling, visible focus i reduced motion.
- Sheet/modal zadržava fokus, sprečava interakciju sa pozadinom i vraća fokus na trigger. Escape, Zatvori i Android Back zatvaraju najviši sloj; Back bez sloja normalno navigira. Ne zarobljavaj korisnika globalnim presretanjem Back-a.
- Check dugmad imaju naziv sa vežbom/serijom/stranom kada postoji. `aria-live` najavljuje rezultat i bitan prelazak, ne svaku sekundu odmora.

## 12. Dokazivanje i testovi prihvatanja

Za promenu poslovne logike napiši relevantne unit testove. Nemoj trošiti vreme na testove koji samo preslikavaju trivijalan CSS ili JSX. Obavezno pokrij:

1. Prazna i pogrešna polja, BW/0, decimalni zarez, prelazne stringove, duration/distance i metric/imperial.
2. Poslednji karakter + trenutna potvrda, dupli tap, lokalni error/retry i ispravnost redosleda upisa.
3. Previous matching: zagrevanje/radne, round/side/direction, backup, različiti ID sa istim nazivom, nema istorije i nejasan legacy.
4. Straight, superset, circuit, nejednake serije, ručni izbor, dodatna serija, promena strukture, uređivanje starog reda i Undo.
5. Postojeći zajednički unilateralni rezultat i legacy odvojeni side redovi. Ne menjaj broj materijalizovanih setova protivno odeljku 7.
6. Jedan odmor nakon validne grupe, izvor timera, Undo, interval/rest konflikt i povratak iz pozadine.
7. Reload/resume, korisnik/session isolation UI stanja i regresiju HistoryDetail-a.
8. EN/SR ključeve i postojeće import/export/snapshot testove.

Proveri layout na 360 × 800, 390 × 844, približno 412 px, zatim 768 i 1024 px. Na fizičkom Android uređaju proveri browser i instaliranu PWA, Gboard, Back, zaključen ekran, odbijene notifications, wake lock i airplane mode. Ako nemaš uređaj ili alat, to eksplicitno napiši; desktop viewport nije fizički device test.

Merljivi ciljevi:

- Na 390 × 844 standardna vežba sa tri serije bez tastature pokazuje naziv, cilj, redove, potvrdu i odmor; okvirni fokus sadržaj ≤680 CSS px kada normalan tekst to dozvoljava.
- Nema horizontalnog skrola na 360 px, sakrivenog naziva, preklopljenog inputa ili nedostupne potvrde.
- Ako ostaje kompaktna cela lista, cilj najmanje 50% manja visina od baseline-a uz isti fixture i font; ne postiži to smanjivanjem accessibility-ja.
- Potvrda pripremljenog validnog unosa: jedan nameran dodir, bez dodatnog modala.
- Tri kruga superseta: nula ručnog vertikalnog traženja partnera.
- Skok na proizvoljnu vežbu: najviše dva dodira preko pregleda.
- Nula izgubljenih znakova, praznih regularno potvrđenih setova i duplih redova u test scenarijima.
- Lokalno čuvanje ne čeka mrežu; izmeri odziv na test uređaju, cilj p95 <300 ms za standardni fixture. Broj nije razlog da preskočiš persistence garancije.

Pokreni `npm run lint`, `npm test` i `npm run build`. E2E i RLS samo kada postoji `.env.test.local` i kada je potvrđeno da se koristi TEST projekat prema SETUP.md. Ne prikazuj sadržaj env fajlova, ključeve ni tokene u izveštaju. Nedostajuće okruženje ne nadoknađuj produkcionim kredencijalima.

Kada nedostaje TEST okruženje, izvrši dostupne unit/build/static provere i UI provere sa bezbednim lokalnim sintetičkim podacima ako takav harness postoji. Ne dodaj produkcioni auth bypass da bi test prošao. Integracione/offline garancije koje nisi proverio prijavi kao neproverene.

Posle prolaska testova nemoj ih beskonačno ponavljati bez nove izmene ili razloga. Fokusiraj dalji rad na sledeći paket i stvarno nerešene slučajeve.

## 13. Isporuka, Git i završni izveštaj

Prati paket po paket: UX-00, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08. Svaka značajna etapa treba da bude upotrebljiva i pregledna. Ne ostavljaj polufunkcionalan fokusirani ekran kao završen feature.

Pre svakog commita pregledaj diff, ukloni debug tragove i stage-uj samo svoje relevantne fajlove. Poštuj važeći AGENTS.md za commit i neposredni push. Ne poništavaj tuđe izmene. Ako push ili obavezna provera ne uspe, navedi stvaran rezultat; ne tvrdi da je deploy završen na osnovu samog pokušaja push-a.

U referentnoj dokumentaciji ili zasebnom kratkom implementation status dokumentu beleži koji paketi su završeni, šta je promenjeno u odnosu na predlog i zašto. Ne prepisuj SETUP.md u nov dokument i ne menjaj audit nalaze tako da izgledaju kao da problem nikad nije postojao.

Završni odgovor korisniku mora sadržati:

1. Šta korisnik sada može brže/jasnije da uradi.
2. Koji paketi su završeni, delimični ili preostali — bez preuveličavanja.
3. Merenja pre/posle na istom fixture-u, sa viewportom i objašnjenjem šta je stvarno mereno.
4. Izvršene komande/provere i njihove rezultate; odvojeno neizvršene Android/E2E/offline provere.
5. Važne odluke o semantici unosa, prethodnim vrednostima, jednostranim serijama i tajmerima.
6. Linkove na relevantne fajlove, commit i stvarni status push-a.

Ne završavaj samo izjavom da UI „izgleda modernije”. Završetak mora biti potkrepljen funkcionalnim tokom, očuvanim podacima i konkretnom proverom.
