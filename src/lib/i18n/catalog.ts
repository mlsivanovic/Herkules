import { currentLocale, type Locale } from './locale'
import { t } from './translate'

export interface ExerciseCopy {
  name: string
  instructions?: string
}

/** Serbian display overlay for system exercises, keyed by catalog UUID. */
export const SR_EXERCISES: Record<string, ExerciseCopy> = {
  '11111111-1111-4111-8111-111111111101': {
    name: 'Čučanj sa šipkom (leđa)',
    instructions:
      'Šipku stavi na gornji deo leđa, stopala u širini ramena. Učvrsti core, savij kukove i kolena i spusti se dok butine ne budu paralelne. Gurni kroz celo stopalo da se vratiš uspravno, grudi gore.',
  },
  '11111111-1111-4111-8111-111111111102': {
    name: 'Bench press sa šipkom',
    instructions:
      'Lezi ravno, oči ispod šipke, hvat malo širi od ramena. Spusti šipku na sredinu grudi sa laktovima oko 45 stepeni od trupa, pa gurni gore i malo unazad do ispruženih ruku.',
  },
  '11111111-1111-4111-8111-111111111103': {
    name: 'Mrtvo dizanje',
    instructions:
      'Stani sa sredinom stopala ispod šipke, savij se i uhvati odmah pored nogu. Ukloni slobodan hod, učvrsti trup i gurni pod nogama dok vučeš šipku uz potkolenice. Završi uspravno, pa spusti sa ravnim leđima.',
  },
  '11111111-1111-4111-8111-111111111104': {
    name: 'Potisak iznad glave',
    instructions:
      'Drži šipku na visini ključne kosti, hvat u širini ramena. Učvrsti gluteuse i stomak, gurni šipku pravo gore pomerajući glavu malo unazad. Završi sa šipkom iznad kukova. Spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111105': {
    name: 'Zgib',
    instructions:
      'Obesi se o vratilo overhand hvatom malo širim od ramena. Povuci laktove nadole dok brada ne prođe vratilo, pa se spusti do ispruženih ruku. Bez ljuljanja.',
  },
  '11111111-1111-4111-8111-111111111106': {
    name: 'Veslanje šipkom',
    instructions:
      'Nagni se oko 45 stepeni, ravna leđa, šipka visí ispod ramena. Povuci šipku ka donjim rebrima, stisni lopatice, pa ispruži ruke kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111107': {
    name: 'Rumunsko mrtvo dizanje',
    instructions:
      'Počni uspravno sa šipkom na kukovima. Guraj kukove nazad uz blago savijena kolena, šipka klizi niz butine dok ne osetiš istezanje zadnje lože. Gurni kukove napred da se uspraviš.',
  },
  '11111111-1111-4111-8111-111111111108': {
    name: 'Pregib bučicama',
    instructions:
      'Stani uspravno sa bučicom u svakoj ruci, dlanovi napred. Podigni tegove bez ljuljanja trupa i bez pomeranja laktova napred. Spusti sporo do pune ekstenzije.',
  },
  '11111111-1111-4111-8111-111111111109': {
    name: 'Trčanje na traci',
    instructions:
      'Trči ravnomernim, razgovornim tempom ili po planiranim intervalima. Beleži ukupnu distancu i trajanje samo trčanja, bez zagrevanja hodanjem.',
  },
  '11111111-1111-4111-8111-111111111110': {
    name: 'Sobni bicikl',
    instructions:
      'Podesi sedište tako da koleno ostane blago savijeno na dnu pedale. Vozi planiranim kadencama i otporom; beleži distancu i trajanje.',
  },
  '11111111-1111-4111-8111-111111111111': {
    name: 'Sprava za veslanje',
    instructions:
      'Prvo gurni nogama, pa se nagni i povuci ručku do donjih rebara. Povratak obrnutim redom: ruke, trup, noge. Beleži distancu i trajanje.',
  },
  '11111111-1111-4111-8111-111111111112': {
    name: 'Vijača',
    instructions:
      'Okreći vijaču iz zglobova, skači tek toliko da vijača prođe. Drži ritam za planirano vreme; broji samo neprekidno preskakanje.',
  },
  '11111111-1111-4111-8111-111111111113': {
    name: 'Mačka–krava',
    instructions:
      'Na četiri noge, naizmenično izvodi savijanje leđa i pogled gore (krava) i zaobljavanje kičme sa bradom ka grudima (mačka). Sporo, uz dah.',
  },
  '11111111-1111-4111-8111-111111111114': {
    name: 'Istezanje pregibača kuka',
    instructions:
      'Iz poluklečećeg stava uvuci karlicu i blago pomeri težinu napred dok ne osetiš istezanje prednje strane kuka. Drži, diši sporo, pa zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111115': {
    name: 'Torakalna rotacija',
    instructions:
      'Sedi na petama, jedna ruka iza glave. Rotiraj lakat ka plafonu prateći ga očima, pa se vrati. U udobnom opsegu, naizmenično strane.',
  },
  '11111111-1111-4111-8111-111111111116': {
    name: 'Prednji čučanj',
    instructions:
      'Šipku drži na prednjim deltama, laktovi visoko. Sedi između kukova, trup uspravan, ustani gurajući pod.',
  },
  '11111111-1111-4111-8111-111111111117': {
    name: 'Čučanj sa pauzom',
    instructions:
      'Spusti se kao u čučnju i zadrži punu sekundu na dnu bez opuštanja. Ustani bez odskoka.',
  },
  '11111111-1111-4111-8111-111111111118': {
    name: 'Čučanj na kutiju',
    instructions:
      'Sedi unazad na kutiju, kratka pauza bez kolapsa, pa eksplozivno ustani uz prilično vertikalne potkolenice.',
  },
  '11111111-1111-4111-8111-111111111119': {
    name: 'Sumo mrtvo dizanje',
    instructions:
      'Širok stav, prsti napolje, hvat unutar kolena. Guraj pod u stranu i drži grudi gore dok se šipka diže.',
  },
  '11111111-1111-4111-8111-111111111120': {
    name: 'Trap bar mrtvo dizanje',
    instructions:
      'Stani unutar trap bara, uhvati ručke, učvrsti se i ustani gurajući pod. Spusti kontrolisanim pregibom.',
  },
  '11111111-1111-4111-8111-111111111121': {
    name: 'Mrtvo dizanje sa deficita',
    instructions:
      'Stani na mali disk ili platformu. Pregni se do šipke i vuci istim cue-ovima kao kod klasičnog mrtvog dizanja, koristeći veći opseg.',
  },
  '11111111-1111-4111-8111-111111111122': {
    name: 'Rack pull',
    instructions:
      'Šipku stavi u rack tik ispod ili iznad kolena. Učvrsti se i zaključaj kukove i leđa bez trzaja.',
  },
  '11111111-1111-4111-8111-111111111123': {
    name: 'Good morning',
    instructions:
      'Šipka na gornjim leđima, meka kolena. Pregni se dok trup ne bude skoro paralelan, pa gurni kukove napred.',
  },
  '11111111-1111-4111-8111-111111111124': {
    name: 'Hip thrust sa šipkom',
    instructions:
      'Gornja leđa na klupi, šipka preko kukova. Gurni kroz pete dok se kukovi ne zaključaju u liniji od kolena do ramena.',
  },
  '11111111-1111-4111-8111-111111111125': {
    name: 'Bench press uski hvat',
    instructions:
      'Hvat odmah unutar širine ramena. Spusti šipku na donje grudi, laktovi bliže trupu, pa gurni gore.',
  },
  '11111111-1111-4111-8111-111111111126': {
    name: 'Kosina bench press šipkom',
    instructions:
      'Klupu podesi na oko 30 stepeni. Spusti šipku na gornje grudi i gurni do ispruženih ruku.',
  },
  '11111111-1111-4111-8111-111111111127': {
    name: 'Decline bench press',
    instructions:
      'Osiguraj noge na decline klupi. Spusti šipku na donje grudi i gurni gore bez odskoka.',
  },
  '11111111-1111-4111-8111-111111111128': {
    name: 'Floor press',
    instructions:
      'Lezi na pod i spusti šipku dok tricepsi ne dodirnu tlo. Pauza pa gurni nazad gore.',
  },
  '11111111-1111-4111-8111-111111111129': {
    name: 'Push press',
    instructions:
      'Blago savij kolena i gurni šipku iznad glave nogama, pa zaključaj ruke. Spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111130': {
    name: 'Power clean',
    instructions:
      'Povuci šipku sa poda, eksplozivno ispruži kukove i uhvati je u četvrt-čučnju u prednjem racku. Ustani da završiš.',
  },
  '11111111-1111-4111-8111-111111111131': {
    name: 'Hang clean',
    instructions:
      'Počni sa šipkom na sredini butine. Blago se pregni, snažno ispruži i uhvati u prednji rack.',
  },
  '11111111-1111-4111-8111-111111111132': {
    name: 'Sleg ramena šipkom',
    instructions:
      'Drži šipku na butinama i slegni ramena pravo gore. Pauza na vrhu, pa spusti sporo.',
  },
  '11111111-1111-4111-8111-111111111133': {
    name: 'Pendlay veslanje',
    instructions:
      'Nagni se do paralelnog trupa, šipka na podu svako ponavljanje. Eksplozivno povuci do donjih grudi i spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111134': {
    name: 'Iskorak sa šipkom',
    instructions:
      'Šipka na leđima, korak napred i spusti zadnje koleno ka podu. Gurni kroz prednje stopalo da ustaneš.',
  },
  '11111111-1111-4111-8111-111111111135': {
    name: 'Hodajući iskorak',
    instructions:
      'Korak napred u iskorak, pa prednju nogu zameni sledećim korakom. Trup uspravan.',
  },
  '11111111-1111-4111-8111-111111111136': {
    name: 'Bugarski split čučanj',
    instructions:
      'Zadnja noga na klupi, prednja dovoljno daleko da koleno ide preko sredine stopala. Spusti se pravo dole i ustani.',
  },
  '11111111-1111-4111-8111-111111111137': {
    name: 'Landmine press',
    instructions:
      'Drži šipku na ramenu, učvrsti core i gurni je gore i malo napred do ispružene ruke.',
  },
  '11111111-1111-4111-8111-111111111138': {
    name: 'Podizanje na prste stojeći',
    instructions:
      'Podigni se na prednji deo stopala kroz pun opseg, pauza, pa spusti pete ispod stepenika.',
  },
  '11111111-1111-4111-8111-111111111139': {
    name: 'Bench press bučicama',
    instructions:
      'Gurni bučice od visine grudi do ispruženih ruku, zglobovi iznad laktova.',
  },
  '11111111-1111-4111-8111-111111111140': {
    name: 'Kosina bench press bučicama',
    instructions:
      'Na blagoj kosini spusti bučice do gornjih grudi, laktovi oko 45 stepeni, pa gurni gore.',
  },
  '11111111-1111-4111-8111-111111111141': {
    name: 'Potisak za ramena bučicama',
    instructions:
      'Gurni bučice od visine uha do ispruženih ruku iznad glave. Ne širi rebra.',
  },
  '11111111-1111-4111-8111-111111111142': {
    name: 'Arnold press',
    instructions:
      'Počni dlanovima ka sebi na ramenima, rotiraj dok guraš tako da na vrhu dlanovi gledaju napred.',
  },
  '11111111-1111-4111-8111-111111111143': {
    name: 'Veslanje jednom bučicom',
    instructions:
      'Osloni se na klupu, povuci bučicu ka kuku i spusti dok se lopatica ne istegne.',
  },
  '11111111-1111-4111-8111-111111111144': {
    name: 'Rumunsko mrtvo dizanje bučicama',
    instructions:
      'Pregni se uz meka kolena, bučice klize niz butine dok zadnja loža ne zategne, pa ustani.',
  },
  '11111111-1111-4111-8111-111111111145': {
    name: 'Goblet čučanj',
    instructions:
      'Drži bučicu ili kettlebell na grudima. Sedi između kukova, laktovi unutar kolena, ustani.',
  },
  '11111111-1111-4111-8111-111111111146': {
    name: 'Razvlačenje bučicama',
    instructions:
      'Uz blago savijene laktove otvori ruke u širokom luku do istezanja grudi, pa spoji bučice.',
  },
  '11111111-1111-4111-8111-111111111147': {
    name: 'Bočno podizanje',
    instructions:
      'Podigni bučice u stranu do tik ispod visine ramena, vodeći laktovima. Spusti sporo.',
  },
  '11111111-1111-4111-8111-111111111148': {
    name: 'Prednje podizanje',
    instructions:
      'Podigni bučice ispred sebe do visine ramena uz blago savijene laktove. Bez ljuljanja.',
  },
  '11111111-1111-4111-8111-111111111149': {
    name: 'Zadnje razvlačenje',
    instructions:
      'Nagni se 45 stepeni i podigni ruke u stranu, stisni zadnje delte na vrhu.',
  },
  '11111111-1111-4111-8111-111111111150': {
    name: 'Hammer pregib',
    instructions:
      'Pregib neutralnim hvatom (palčevi gore). Laktovi prilepljeni, spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111151': {
    name: 'Pregib na kosoj klupi',
    instructions:
      'Sedi na kosoj klupi i pregni iz potpuno istegnutog položaja bez ljuljanja ramena.',
  },
  '11111111-1111-4111-8111-111111111152': {
    name: 'Ekstenzija tricepsa iznad glave',
    instructions:
      'Drži bučicu iznad glave, savij laktove da je spustiš iza glave, pa ispruži do zaključanih ruku.',
  },
  '11111111-1111-4111-8111-111111111153': {
    name: 'Pullover bučicom',
    instructions:
      'Spusti bučicu iza glave uz meke laktove do istezanja latova, pa je povuci nazad preko grudi.',
  },
  '11111111-1111-4111-8111-111111111154': {
    name: 'Farmersko nošenje',
    instructions:
      'Podigni težak par tegova, učvrsti se i hodi kratkim ravnomernim koracima. Beleži vreme nošenja.',
  },
  '11111111-1111-4111-8111-111111111155': {
    name: 'Kettlebell swing',
    instructions:
      'Pregni se i zavitlaj zvono unazad, pa škljocni kukovima da odleti do visine grudi. Nije čučanj.',
  },
  '11111111-1111-4111-8111-111111111156': {
    name: 'Tursko ustajanje',
    instructions:
      'Iz ležanja gurni zvono gore i ustani kroz kontrolisanu sekvencu, oči na tegu. Obrnuto se vrati na pod.',
  },
  '11111111-1111-4111-8111-111111111157': {
    name: 'Leg press',
    instructions:
      'Stopala na sredini platforme, spusti dok butine ne priđu trupu bez zaobljavanja donjih leđa, pa gurni kroz celo stopalo.',
  },
  '11111111-1111-4111-8111-111111111158': {
    name: 'Hack squat',
    instructions:
      'Leđa uz jastuk, spusti se dok butine nisu bar paralelne, pa gurni gore bez oštrog zaključavanja.',
  },
  '11111111-1111-4111-8111-111111111159': {
    name: 'Ekstenzija nogu',
    instructions:
      'Ispruži kolena dok noge nisu prave, pauza, pa spusti bez udaranja tegova.',
  },
  '11111111-1111-4111-8111-111111111160': {
    name: 'Pregib nogu ležeći',
    instructions:
      'Povuci jastuk ka gluteusima, stisni, spusti sporo. Kukovi ostaju na klupi.',
  },
  '11111111-1111-4111-8111-111111111161': {
    name: 'Pregib nogu sedeći',
    instructions:
      'Osiguraj jastuk preko krila i povuci pete ispod sedišta. Kontrolisan povratak.',
  },
  '11111111-1111-4111-8111-111111111162': {
    name: 'Podizanje na prste sedeći',
    instructions:
      'Podigni se na prednji deo stopala, pauza, pa spusti pete kroz puno istezanje.',
  },
  '11111111-1111-4111-8111-111111111163': {
    name: 'Chest press mašina',
    instructions:
      'Ručke u visini sredine grudi, gurni do ispruženih ruku bez slegovanja, pa se vrati kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111164': {
    name: 'Pec deck',
    instructions:
      'Spoji jastuke pokretom zagrljaja i vrati se do udobnog istezanja grudi.',
  },
  '11111111-1111-4111-8111-111111111165': {
    name: 'Lat pulldown',
    instructions:
      'Povuci šipku do gornjih grudi, laktovi nadole, pa pusti ramena da se istegnu na povratku.',
  },
  '11111111-1111-4111-8111-111111111166': {
    name: 'Veslanje sajlom sedeći',
    instructions:
      'Povuci ručku do stomaka, stisni lopatice i ispruži ruke skroz svako ponavljanje.',
  },
  '11111111-1111-4111-8111-111111111167': {
    name: 'Face pull',
    instructions:
      'Povuci uže ka licu uz spoljašnju rotaciju tako da knukle idu unazad. Pauza pa povratak.',
  },
  '11111111-1111-4111-8111-111111111168': {
    name: 'Razvlačenje sajlama',
    instructions:
      'Iz blagog naginjanja spoji ručke u širokom luku i kontrolisano otvori.',
  },
  '11111111-1111-4111-8111-111111111169': {
    name: 'Triceps pushdown',
    instructions:
      'Laktovi prilepljeni uz bok, ispruži ruke skroz i vrati se do oko 90 stepeni.',
  },
  '11111111-1111-4111-8111-111111111170': {
    name: 'Pregib sajlom',
    instructions:
      'Pregni šipku ili ručku bez pomeranja laktova napred. Spusti sporo.',
  },
  '11111111-1111-4111-8111-111111111171': {
    name: 'Crunch na sajli',
    instructions:
      'Kleči, drži uže kod glave i skupi rebra ka karlici. Ne vuci rukama.',
  },
  '11111111-1111-4111-8111-111111111172': {
    name: 'Abdukcija kukova',
    instructions:
      'Guraj jastuke u stranu protiv otpora i vrati se bez udaranja tegova.',
  },
  '11111111-1111-4111-8111-111111111173': {
    name: 'Adukcija kukova',
    instructions:
      'Stisni jastuke jedno ka drugom i kontrolisano otvori. Trup miran.',
  },
  '11111111-1111-4111-8111-111111111174': {
    name: 'Zgib podhvat',
    instructions:
      'Podhvat, povuci dok brada ne prođe vratilo, pa se spusti u mrtav vis.',
  },
  '11111111-1111-4111-8111-111111111175': {
    name: 'Zgib neutralni hvat',
    instructions:
      'Koristi paralelne ručke. Povuci laktove nadole dok grudi ne priđu vratilu, pa se spusti skroz.',
  },
  '11111111-1111-4111-8111-111111111176': {
    name: 'Dip',
    instructions:
      'Blago se nagni napred, spusti se dok ramena ne budu ispod laktova, pa gurni gore.',
  },
  '11111111-1111-4111-8111-111111111177': {
    name: 'Sklek',
    instructions:
      'Šake ispod ramena, telo u pravoj liniji. Spusti grudi ka podu i gurni nazad gore.',
  },
  '11111111-1111-4111-8111-111111111178': {
    name: 'Dijamant sklek',
    instructions:
      'Šake blizu ispod grudi. Laktovi uz telo, telo kruto.',
  },
  '11111111-1111-4111-8111-111111111179': {
    name: 'Pike sklek',
    instructions:
      'Kukovi visoko u pike stavu, spusti glavu ka podu između šaka, pa gurni gore.',
  },
  '11111111-1111-4111-8111-111111111180': {
    name: 'Obrnuto veslanje',
    instructions:
      'Obesi se ispod vratila ravnim telom. Povuci grudi ka vratilu i spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111181': {
    name: 'Pištolj čučanj',
    instructions:
      'Stani na jednu nogu, drugu ispruži napred i sedi koliko kontrolišeš. Ustani bez pada u stranu.',
  },
  '11111111-1111-4111-8111-111111111182': {
    name: 'Nordijski pregib',
    instructions:
      'Kleči sa fiksiranim člancima, spusti trup napred što sporije, pa se povuci ili gurni da se resetuješ.',
  },
  '11111111-1111-4111-8111-111111111183': {
    name: 'Podizanje nogu u visu',
    instructions:
      'Visi mirno i podigni noge bar do paralelnog položaja bez ljuljanja. Spusti sporo.',
  },
  '11111111-1111-4111-8111-111111111184': {
    name: 'Daska',
    instructions:
      'Laktovi ispod ramena, telo u pravoj liniji. Učvrsti se kao da očekuješ udarac i diši.',
  },
  '11111111-1111-4111-8111-111111111185': {
    name: 'Bočna daska',
    instructions:
      'Složi stopala, podigni kukove i drži pravu liniju od glave do peta. Zameni stranu na pola ako treba.',
  },
  '11111111-1111-4111-8111-111111111186': {
    name: 'Hollow hold',
    instructions:
      'Pritisni donja leđa u pod, podigni ramena i noge i drži oblik banane.',
  },
  '11111111-1111-4111-8111-111111111187': {
    name: 'Superman hold',
    instructions:
      'Lezi na stomak i podigni grudi, ruke i noge od poda. Vrat dug.',
  },
  '11111111-1111-4111-8111-111111111188': {
    name: 'Burpee',
    instructions:
      'Čučanj, šake na pod, skok nogama nazad, sklek ako je planiran, skok nogama unutra i ustani ili skoči.',
  },
  '11111111-1111-4111-8111-111111111189': {
    name: 'Mountain climber',
    instructions:
      'Iz visokog plank-a guraj kolena ka grudima u ravnomernom ritmu bez ljuljanja kukova.',
  },
  '11111111-1111-4111-8111-111111111190': {
    name: 'Trčanje napolju',
    instructions:
      'Trči napolju planiranim tempom. Beleži samo deo trčanja, ne hodanje za zagrevanje.',
  },
  '11111111-1111-4111-8111-111111111191': {
    name: 'Hodanje napolju',
    instructions: 'Brzo hodanje. Beleži ukupnu distancu i trajanje.',
  },
  '11111111-1111-4111-8111-111111111192': {
    name: 'Eliptični trenažer',
    instructions:
      'Stani uspravno, guraj kroz celo stopalo i drži gladak kadar za planirano vreme i distancu.',
  },
  '11111111-1111-4111-8111-111111111193': {
    name: 'Stepenice',
    instructions:
      'Stani uspravno, uzimaj pune korake i ne naslanjaj se teško na rukohvate.',
  },
  '11111111-1111-4111-8111-111111111194': {
    name: 'Assault bike',
    instructions:
      'Guraj i vuci ručke dok pedališeš. Beleži distancu i vreme sa sprave.',
  },
  '11111111-1111-4111-8111-111111111195': {
    name: 'SkiErg',
    instructions:
      'Pregni se i povuci ručke nadole pored kukova, pa se vrati uspravno. Beleži distancu i trajanje.',
  },
  '11111111-1111-4111-8111-111111111196': {
    name: 'Plivanje',
    instructions:
      'Beleži ukupnu plivačku distancu i vreme, bez odmora na zidu ako želiš samo rad.',
  },
  '11111111-1111-4111-8111-111111111197': {
    name: 'Bicikl napolju',
    instructions:
      'Vozi planiranim naporom. Beleži vreme u pokretu i distancu sa računara ili telefona.',
  },
  '11111111-1111-4111-8111-111111111198': {
    name: 'Planinarenje',
    instructions:
      'Beleži distancu staze i ukupno vreme u pokretu. Uspon možeš u beleške treninga.',
  },
  '11111111-1111-4111-8111-111111111199': {
    name: 'Battle ropes',
    instructions:
      'Naizmenično ili udaraj užad uz meka kolena. Beleži samo radno vreme.',
  },
  '11111111-1111-4111-8111-111111111200': {
    name: 'World’s Greatest Stretch',
    instructions:
      'Iz iskoraka spusti unutrašnju ruku i rotiraj drugu ka nebu, pa sedi kukovima unazad da istegneš zadnju ložu. Menjaj strane.',
  },
  '11111111-1111-4111-8111-111111111201': {
    name: 'Istezanje golub',
    instructions:
      'Prednja potkolenica popreko, zadnja noga duga. Kukovi ravni, nagni se napred koliko je udobno. Zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111202': {
    name: 'Istezanje zadnje lože',
    instructions:
      'Pregni se preko prave ili blago savijene noge do blagog istezanja. Diši, ne odskakuj.',
  },
  '11111111-1111-4111-8111-111111111203': {
    name: 'Couch stretch',
    instructions:
      'Zadnje stopalo uz zid ili kauč, prednje zasađeno. Uvuci karlicu i ostani visok. Zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111204': {
    name: '90/90 istezanje kukova',
    instructions:
      'Sedi sa oba kolena pod 90 stepeni. Drži grudni koš visoko i nagni se ka prednjem kuku. Zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111205': {
    name: 'Shoulder dislocate',
    instructions:
      'Drži širok hvat i prebaci ruke preko glave i iza leđa bez forsiranja krajnjeg opsega.',
  },
  '11111111-1111-4111-8111-111111111206': {
    name: 'Razvlačenje lastika',
    instructions:
      'Drži lastiku u visini grudi i razvuci je dok ne dodirne grudi. Kontrolisan povratak.',
  },
  '11111111-1111-4111-8111-111111111207': {
    name: 'Pozicija deteta',
    instructions:
      'Sedi kukovima ka petama, ruke duge, diši u leđa.',
  },
  '11111111-1111-4111-8111-111111111208': {
    name: 'Pas nadole',
    instructions:
      'Kukovi visoko, pete ka podu, ruke duge. Pedaliraj stopalima i drži dugu kičmu.',
  },
  '11111111-1111-4111-8111-111111111209': {
    name: 'Provuci iglu',
    instructions:
      'Sa četiri noge provuci jednu ruku ispod druge i odmaraj na ramenu. Diši, pa zameni.',
  },
  '11111111-1111-4111-8111-111111111210': {
    name: 'Mrtav vis',
    instructions:
      'Visi pasivno ili uz blago setovanje lopatica. Opušti ramena koliko je udobno i diši.',
  },
  '11111111-1111-4111-8111-111111111211': {
    name: 'Istezanje grudi u vratima',
    instructions:
      'Podlakticu na štok vrata, zakorači kroz dok ne osetiš istezanje preko grudi. Zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111212': {
    name: 'Njihanje članaka',
    instructions:
      'U poluklečećem stavu guraj prednje koleno preko prstiju bez podizanja pete. Zameni stranu.',
  },
  '11111111-1111-4111-8111-111111111213': {
    name: 'Rolovanje kvadricepsa',
    instructions:
      'Rolaj sporo od kuka do kolena, pauziraj na osetljivim mestima. Core učvršćen.',
  },
  '11111111-1111-4111-8111-111111111214': {
    name: 'Krugovi zglobova',
    instructions:
      'Isprepleti prste ili radi jedan zglob: spori, puni krugovi u oba smera.',
  },
  '11111111-1111-4111-8111-111111111215': {
    name: 'Čučanj sopstvenom težinom',
    instructions:
      'Stopala oko širine ramena. Sedi između kukova, grudi gore, ustani gurajući pod. Kolena prate stopala.',
  },
  '11111111-1111-4111-8111-111111111216': {
    name: 'Sklek lopaticama',
    instructions:
      'Visoki plank, ruke prave. Pusti grudi da potonu stiskom lopatica, pa gurni pod da ih rastaviš. Laktovi zaključani.',
  },
  '11111111-1111-4111-8111-111111111217': {
    name: 'Spoljašnja rotacija',
    instructions:
      'Lakat prilepljen uz bok (mali peškir pomaže). Rotiraj podlakticu napolje, pa se sporo vrati. Lakat ne luta.',
  },
  '11111111-1111-4111-8111-111111111218': {
    name: 'Veslanje bučicama sa osloncem',
    instructions:
      'Lezi grudima na kosu klupu. Povuci laktove ka kukovima, pauza, spusti kontrolisano. Ne trzaj rukama.',
  },
  '11111111-1111-4111-8111-111111111219': {
    name: 'Ekstenzija zgloba',
    instructions:
      'Podlaktica potpuno oslonjena, dlan dole. Ispruži samo zglob, pa spusti sporo. Podlaktica miruje.',
  },
  '11111111-1111-4111-8111-111111111220': {
    name: 'Izometrijski hammer pregib',
    instructions:
      'Drži neutralni (hammer) hvat sa laktom oko 90 stepeni. Jaka ali bezbolna kontrakcija — nije maksimalni grind. Beleži vreme zadržavanja.',
  },
  '11111111-1111-4111-8111-111111111221': {
    name: 'Glute bridge',
    instructions:
      'Lezi na leđa, stopala zasađena. Gurni kroz pete dok se kukovi ne zaključaju u liniji od kolena do ramena, pa spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111222': {
    name: 'Pregib u kukovima',
    instructions:
      'Meka kolena, guraj kukove nazad uz dugu kičmu. Oseti zadnju ložu, pa se uspravi gurajući kukove napred. Ovo nije čučanj.',
  },
  '11111111-1111-4111-8111-111111111223': {
    name: 'Mrtvo dizanje kettlebellom',
    instructions:
      'Zvono između stopala. Pregni se, uhvati, učvrsti i ustani gurajući pod. Spusti istim pregibom.',
  },
  '11111111-1111-4111-8111-111111111224': {
    name: 'Jednonožno rumunsko mrtvo dizanje',
    instructions:
      'Pregni se na jednoj nozi, kukovi ravni, stojeće koleno meko. Slobodna noga ide unazad. Težina je sekundarna u odnosu na balans.',
  },
  '11111111-1111-4111-8111-111111111225': {
    name: 'Poluklečeći potisak sajlom jednom rukom',
    instructions:
      'Poluklečeći, suprotna ruka gura. Stisni gluteus donjeg kolena, rebra dole, gurni bez rotacije trupa.',
  },
  '11111111-1111-4111-8111-111111111226': {
    name: 'Step-up',
    instructions:
      'Kutija dovoljno visoka da radna butina bude oko paralelna. Gurni kroz prednje stopalo — ne odguruj zadnjom nogom. Ustani visoko, pa spusti kontrolisano.',
  },
  '11111111-1111-4111-8111-111111111227': {
    name: 'Suitcase carry',
    instructions:
      'Jedan težak teg sa strane. Hodi visoko bez naginjanja ka tegu ili od njega. Kratki stabilni koraci. Beleži vreme nošenja.',
  },
  '11111111-1111-4111-8111-111111111228': {
    name: 'Pallof press',
    instructions:
      'Stani bočno ka sajli, gurni ručku pravo napred i drži. Ne dozvoli da te teg rotira. Vrati na grudi i ponovi.',
  },
  '11111111-1111-4111-8111-111111111229': {
    name: 'Mrtva buba',
    instructions:
      'Donja leđa ostaju na podu. Izdahni dok pružaš suprotnu ruku i nogu. Ako se leđa odlepe, skratiti opseg.',
  },
  '11111111-1111-4111-8111-111111111230': {
    name: 'Scaption raise',
    instructions:
      'Vrlo lake bučice. Podigni ruke 30–45 stepeni ispred bočne ravni, palčevi gore, do visine ramena. Bez ljuljanja.',
  },
  '11111111-1111-4111-8111-111111111231': {
    name: 'Pronacija/supinacija zgloba',
    instructions:
      'Podlaktica oslonjena, lakat miran. Okreći dlan gore-dole kroz kontrolisan opseg. Beleži ponavljanja ili vreme.',
  },
}

const MUSCLE: Record<string, string> = {
  quads: 'kvadriceps',
  glutes: 'gluteusi',
  hamstrings: 'zadnja loža',
  core: 'core',
  chest: 'grudi',
  triceps: 'triceps',
  shoulders: 'ramena',
  back: 'leđa',
  lats: 'latovi',
  biceps: 'biceps',
  'upper back': 'gornja leđa',
  'lower back': 'donja leđa',
  'full body': 'celo telo',
  calves: 'listovi',
  spine: 'kičma',
  'hip flexors': 'pregibači kuka',
  'thoracic spine': 'torakalna kičma',
  traps: 'trapez',
  legs: 'noge',
  'rear delts': 'zadnje delte',
  forearms: 'podlaktice',
  abs: 'trbušnjaci',
  adductors: 'aduktori',
  obliques: 'kosi trbušni',
  hips: 'kukovi',
  wrists: 'zglobovi',
  grip: 'stisak',
  ankles: 'članci',
  'rotator cuff': 'rotatorna manžetna',
  arms: 'ruke',
}

const EQUIPMENT: Record<string, string> = {
  barbell: 'šipka',
  rack: 'rack',
  bench: 'klupa',
  'pull-up bar': 'vratilo',
  dumbbells: 'bučice',
  treadmill: 'traka',
  'stationary bike': 'sobni bicikl',
  rower: 'sprava za veslanje',
  'jump rope': 'vijača',
  mat: 'podloga',
  'trap bar': 'trap bar',
  plates: 'diskovi',
  box: 'kutija',
  'incline bench': 'kosa klupa',
  'decline bench': 'decline klupa',
  landmine: 'landmine',
  step: 'stepenik',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebelli',
  'leg press': 'leg press',
  'hack squat': 'hack squat',
  'leg extension': 'ekstenzija nogu',
  'leg curl': 'pregib nogu',
  'calf machine': 'sprava za listove',
  machine: 'mašina',
  'pec deck': 'pec deck',
  cable: 'sajla',
  rope: 'uže',
  'dip bars': 'razboj',
  bodyweight: 'sopstvena težina',
  bar: 'vratilo',
  rings: 'karike',
  'partner or Nordic bench': 'partner ili nordijska klupa',
  none: 'bez opreme',
  elliptical: 'eliptik',
  'stair machine': 'sprava za stepenice',
  'air bike': 'air bike',
  SkiErg: 'SkiErg',
  pool: 'bazen',
  bicycle: 'bicikl',
  'battle ropes': 'battle ropes',
  'bench or wall': 'klupa ili zid',
  'band or stick': 'lastika ili štap',
  band: 'lastika',
  doorway: 'vrata',
  'foam roller': 'roler',
}

const TENDON_SITES: Record<string, string> = {
  'Knee L': 'checkin.siteKneeL',
  'Knee R': 'checkin.siteKneeR',
  'Shoulder L': 'checkin.siteShoulderL',
  'Shoulder R': 'checkin.siteShoulderR',
  'Elbow L': 'checkin.siteElbowL',
  'Elbow R': 'checkin.siteElbowR',
  'Achilles L': 'checkin.siteAchillesL',
  'Achilles R': 'checkin.siteAchillesR',
  'Wrist L': 'checkin.siteWristL',
  'Wrist R': 'checkin.siteWristR',
  Hip: 'checkin.siteHip',
  'Lower back': 'checkin.siteLowerBack',
}

const NAME_TO_ID = new Map(
  Object.entries(SR_EXERCISES).map(([id, copy]) => [copy.name.toLowerCase(), id]),
)

export function displayExerciseName(
  exercise: { id?: string | null; owner_id?: string | null; name: string },
  locale: Locale = currentLocale(),
): string {
  if (locale !== 'sr') return exercise.name
  if (exercise.owner_id) return exercise.name
  const byId = exercise.id ? SR_EXERCISES[exercise.id] : undefined
  if (byId?.name) return byId.name
  return exercise.name
}

export function displayExerciseInstructions(
  exercise: { id?: string | null; owner_id?: string | null; instructions: string | null },
  locale: Locale = currentLocale(),
): string | null {
  if (locale !== 'sr' || exercise.owner_id) return exercise.instructions
  const byId = exercise.id ? SR_EXERCISES[exercise.id] : undefined
  return byId?.instructions ?? exercise.instructions
}

export function displaySnapshotName(
  name: string,
  exerciseId: string | null | undefined,
  locale: Locale = currentLocale(),
): string {
  if (locale !== 'sr') return name
  if (exerciseId && SR_EXERCISES[exerciseId]?.name) return SR_EXERCISES[exerciseId].name
  return name
}

export function exerciseMatchesQuery(
  exercise: { id: string; owner_id: string | null; name: string },
  needle: string,
): boolean {
  if (needle === '') return true
  const q = needle.toLowerCase()
  if (exercise.name.toLowerCase().includes(q)) return true
  const srName = SR_EXERCISES[exercise.id]?.name
  return Boolean(srName && srName.toLowerCase().includes(q))
}

export function displayTag(tag: string, locale: Locale = currentLocale()): string {
  if (locale !== 'sr') return tag
  return MUSCLE[tag] ?? EQUIPMENT[tag] ?? tag
}

export function displayTags(tags: string[], locale: Locale = currentLocale()): string {
  return tags.map((tag) => displayTag(tag, locale)).join(', ')
}

export function displayTendonSite(site: string, locale: Locale = currentLocale()): string {
  if (locale !== 'sr') return site
  const key = TENDON_SITES[site]
  return key ? t(key as 'checkin.siteKneeL', undefined, locale) : site
}

export function tendonSiteValue(label: string): string {
  const lower = label.toLowerCase()
  for (const [stored, key] of Object.entries(TENDON_SITES)) {
    if (stored.toLowerCase() === lower) return stored
    if (t(key as 'checkin.siteKneeL', undefined, 'sr').toLowerCase() === lower) return stored
  }
  return label
}

export function translatedNameIds(): string[] {
  return Object.keys(SR_EXERCISES)
}

export { NAME_TO_ID }
