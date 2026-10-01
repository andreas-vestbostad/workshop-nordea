# Case A: Forklar hvorfor porteføljen utvikler seg

Løsningen gir Anne et panel under utviklingsgrafen på Portfolio-siden («Why did my portfolio change?»),
et nytt API-endepunkt `GET /customers/:customerId/performance/explanation` og en ny Copilot-intensjon
(«Why did my portfolio change?»). Panelet svarer på fire spørsmål:

1. **Hva flyttet porteføljen?** Hvilke beholdninger trakk opp og hvilke trakk ned (bidrag i prosentpoeng).
2. **Markedet eller egne valg?** Avkastningen til en enkel referansemiks for risikoprofilen («det markedet ga»)
   sammenlignet med Annes avkastning. Differansen er effekten av hva hun eier.
3. **Er dette normalt?** Om resultatet ligger under, innenfor eller over et typisk spenn for risikoprofilen.
4. **Hva har vi antatt?** Begrensninger og antakelser vises alltid under «How is this calculated?».

Alle beregninger er deterministiske (ingen LLM) og bygger på `calculatePerformance()`, slik at tallene
alltid stemmer med grafen. Logikken ligger i `api/src/services/performanceExplanation.ts`.

## Data som brukes

- **Beholdninger** (`data/investments.json`): ticker, navn, aktivatype, antall og dagens kurs.
- **Daglige kurser** (`data/market_data.json`): pris per ticker per dag (ca. 90 dager).
- **Risikoprofil** (`data/customers.json`): Conservative, Moderate, Balanced, Growth eller Aggressive.

## Data som mangler

- **Posisjonshistorikk (kjøp og salg).** Uten den kan vi ikke skille «markedet beveget seg» fra «kunden satte inn
  penger eller handlet». Med posisjonshistorikk kunne vi beregnet tidsvektet avkastning (TWR).
- **En ekte referanseindeks.** Referansemiksen er bygget av fiktive indeksfond i demoen.
- **Et halvt år eller mer med kurser.** Demoen har bare ca. 90 dager, mens Anne spør om det siste halvåret.
- **Gebyrer og utbytte.** Disse påvirker reell avkastning, men finnes ikke i datasettet.

## Antakelser

- **Dagens antall holdes hele perioden.** Samme forenkling som i utviklingsgrafen.
- **Referansemikser per risikoprofil** (andel global aksje / obligasjoner / kontanter):

  | Profil | GLBEQ | CORPB | CASHNOK |
  | --- | --- | --- | --- |
  | Conservative | 20 % | 60 % | 20 % |
  | Moderate | 35 % | 55 % | 10 % |
  | Balanced | 50 % | 45 % | 5 % |
  | Growth | 75 % | 25 % | 0 % |
  | Aggressive | 90 % | 10 % | 0 % |

- **Forventet årlig avkastning og svingning per profil**, skalert til periodelengden:
  `forventet = årsavkastning × dager/365`, `bånd = årlig svingning × √(dager/365)`, spenn = `forventet ± bånd`.

  | Profil | Årsavkastning | Årlig svingning |
  | --- | --- | --- |
  | Conservative | 3 % | 4 % |
  | Moderate | 4 % | 7 % |
  | Balanced | 5 % | 10 % |
  | Growth | 6 % | 14 % |
  | Aggressive | 7 % | 18 % |

  Dette er pedagogiske antakelser, ikke prognoser. De vises til kunden.

## Evaluering med kundecaser

| Kunde | Profil | Avkastning | Resultat |
| --- | --- | --- | --- |
| `CUST-00048` (normal, «Anne») | Balanced | +4,9 % | Innenfor typisk spenn (−3,7 % til +6,2 %). Referansemiks +1,6 %, egne valg +3,3 pp. |
| `CUST-00028` (overraskende) | Conservative | +11,8 % | **Over typisk spenn** (−1,2 % til +2,7 %). Drevet av én energiaksje (+5,5 pp). |
| `CUST-00072` (negativ) | Aggressive | −1,1 % | Viser «Pulled your portfolio down», og ordlyden er rolig. Innenfor typisk spenn. |
| `CUST-00017` (ingen beholdninger) | Conservative | 0 % | Ingen krasj, bare en vennlig melding. |
| Manglende kurshistorikk (simulert) | – | – | `data_warnings` viser hvilken ticker som mangler, og at dagens kurs ble brukt. |

Gjenstår: få en annen person til å lese panelet og forklare med egne ord hva som skjedde (oppgave 6.6).

## Kundeverdi og hvordan den måles

- **Målet:** Anne skal kunne si i én setning hvorfor porteføljen endret seg.
- **Brukertest:** La 3–5 personer lese panelet for en kunde og forklare tilbake med egne ord. Noter hva de misforstår.
- **Driftsmål:** Færre «hvorfor endret verdien seg?»-henvendelser til rådgivere, og bruk av Copilot-spørsmålet.

## Risikoer

- **Misforståelse av «effekten av dine valg».** Den handler om *hva hun eier* sammenlignet med referansemiksen,
  ikke om at hun har vært flink eller dårlig til å handle.
- **Falsk presisjon.** Tallene vises med én desimal, og begrensningene vises alltid.
- **«Over forventet» kan leses som råd eller som «bra».** Over spennet betyr ofte at porteføljen tar mer risiko
  enn profilen tilsier (som for `CUST-00028`). Teksten bør ikke oppfordre til kjøp eller salg.
- **Utdaterte eller manglende kurser.** Fanges av `data_warnings`, både for kundens beholdninger og for
  tickere i referansemiksen.

## Valgfritt AI-lag

En LLM kan skrive om `summary` til en vennligere tone. Den skal da få **bare** JSON-en fra endepunktet som input,
aldri finne på egne tall og alltid beholde begrensningene. Den deterministiske teksten er reserveløsningen hvis
LLM-en feiler eller svaret ikke kan valideres mot tallene.
