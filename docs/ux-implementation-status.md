# Status implementacije mobilnog UX-a

Audit i plan ostaju u `docs/ui-ux-review-and-implementation-plan.md`. Ovaj dokument samo beleži šta je urađeno posle tog audita i šta namerno nije dirano. Početni kod audita je `9063ef5`. Ova isporuka kreće od `0c44a35`.

## Paketi

| Paket | Status | Šta je urađeno |
| --- | --- | --- |
| UX-00 | Delimično | Sintetički slučajevi su u `workoutFlow.test.ts` i `metrics.test.ts`. Nema novog browser merenja visine. Baseline ispod je iz audita i iz CSS-a koji je važio pre ove izmene. |
| UX-01 | Završen | Potvrda ide iz trenutnog drafta. Prazan set, `8.5`, nedovršen `82,` i nula ponavljanja ne prolaze. Težina 0 i BW ostaju važeći. Prethodni rezultat se pari po id-u, zagrevanju, ordinalu, strani i smeru. Upisi iste sesije idu jedan za drugim. |
| UX-02 | Završen u novom prikazu | Retke radnje su u meniju i detaljima serije. Naziv se prelama. Kontrole serije su 48 px. Stara lista svih otvorenih kartica više nije glavni tok. |
| UX-03 | Završen | Jedna stanica, pregled u `BottomSheet`, Prethodna/Sledeća, fokus u `localStorage` po korisniku i sesiji. Ručni prelaz ne završava seriju. Logout i brisanje sesije brišu taj UI state. |
| UX-04 | Završen | `src/lib/workoutFlow.ts` bira sledeći red i odmor bez tajmera i mreže. Superset/circuit idu na partnera. Nejednak broj serija ne pravi nove redove. Zagrevanje ne ulazi u radni broj. Undo gasi samo odmor te potvrde. |
| UX-05 | Delimično | Native `inputMode`, jedan skrol, visina docka, finish sheet, prazna sesija bez `window.confirm`. `VisualViewport` nije uveden. Android matrica nije rađena. |
| UX-06 | Delimično | Today više nema drugi plutajući Resume. Sync bedž ćuti kad nema problema; čekanje kaže da je sačuvano lokalno. Nazivi vežbi se prelamaju, Save rutine je lepljiv. Dugo trajanje se samo opisuje, ne prepisuje. Draft rutine pri odlasku sa editora još nije sačuvan. |
| UX-07 | Delimično | Istorija: pretraga, red metrika, povratak čuva skrol. Detalj je pregled dok se ne pritisne Uredi i ne pali odmor. Today je zbijeniji. Progress sekcije nisu preuređene. |
| UX-08 | Delimično | Picker ima Nedavno iz istorije i oznaku prilagođene vežbe pored sistemske. Kalendar agenda, pregrupisanje Settings i poseban coach/role prolaz nisu rađeni. |

## Odluke

- `materializePlannedSets` i dalje pravi jedan zajednički red po strani/nozi (`side: null`). Posebni pronation/supination i već postojeći levi/desni redovi ostaju zasebni. Potvrda jednog ne potvrđuje drugi.
- Opseg ponavljanja se ne pretvara u broj. Zamenska vežba ne nasleđuje ciljnu težinu primarne. Isti naziv sa drugim id-jem nije ista vežba.
- Odmor i dalje koristi deadline. Interval tajmer gasi automatski odmor. Tajmer ne završava seriju.
- Napomena koja pominje pauzu između partnera ne pokreće novi tajmer. Strukturirani odmor je i dalje posle kruga.
- Neuobičajeno trajanje (preko 4 h) dobija objašnjenje u finish sheetu i detalju istorije. Trajanje se ne seče i cardio posle snage se ne briše. Politika ispravke istorije ostaje posebna odluka.

## Merenje

Isti fiksni browser prolaz pre i posle na 390×844 nije rađen u ovoj sesiji, pa broj 680 px i smanjenje od 50% nisu izmereni rezultati.

Pre izmene, iz audita i tadašnjeg CSS-a:

- šest otvorenih vežbi na 390×844, oko 3782 CSS px visine dokumenta
- prva otvorena kartica oko 534 px, sklopljena oko 180 px
- potvrda `.btn--small` 36 px, unos `.input--cell` 40 px

Posle izmene, iz stilova, bez layout merenja:

- unos serije i potvrda/poništavanje/dodavanje imaju min. 48 px, broj u unosu je 16 px
- glavni tok crta jednu stanicu, ne šest otvorenih kartica

## Provere

- `npm run lint` — 0 grešaka
- `npm test` — 341 testova
- `npm run build` — prošao
- `.env.test.local` nije prisutan, pa E2E i RLS nisu pokretani
- Fizički Android, instalirana PWA, Gboard, Back, wake lock i airplane mode nisu provereni
- p95 lokalnog upisa nije meren na uređaju. Upis i dalje ide prvo u IndexedDB i ne čeka mrežu.
