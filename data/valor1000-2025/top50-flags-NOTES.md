# Valor 1000 2025 top-50 flags (issue #24)

**Project:** Billionaire Watcher freeze protocol  
**Issue:** GitHub #24 (parent #22)  
**Retrieved:** 2026-08-24  
**Universe:** `/workspace/valor1000-2025-top50.csv` (50 groups, receita líquida FY 2024). Valor was **not** re-scraped.  
**Not done:** freeze CSV; persons ticket #25; Forbes #26; clone of the GitHub repo.

No row is labeled UBO / dono. RF edges stay for later tickets as `sócio`. QSA table name used: `basedosdados.br_me_cnpj` (empresas / estabelecimentos). Alias `br_rf_cnpj` was not used.

---

## Method

1. **CNPJ** — BigQuery `basedosdados.br_me_cnpj.empresas` partition `data = 2026-01-11` (latest snapshot returned by `MAX(data)`), billing project `billionarewatcher`. Matched Valor `razao_social` by exact / punctuation-normalized name, then confirmed matriz CNPJ on `estabelecimentos` (`identificador_matriz_filial='1'`). If several RF rows shared a name, the match required CVM CNPJ and/or natureza + multi-billion `capital_social`. Ambiguous leftovers were not guessed.
2. **listed_flag** — CVM cadastre `cad_cia_aberta.csv` from `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv` (latin-1, 2,677 rows, downloaded 2026-08-24). `true` iff `SIT=ATIVO` for that CNPJ. Cancelled registries are `false` with `DT_CANCEL`. Categoria A or B both count. B3 consulta used only as a ticker/shareholding supplement (Telefônica).
3. **soe_flag** — `true` only if **União is the Art. 116 controller** / federal SOE in the Petrobras–BB–Caixa–BNDES peer sense. Evidence required: Carta Anual / SEP / company IR / SEST perimeter — not CVM `CONTROLE_ACIONARIO=ESTATAL` alone (that field is stale for Axia/Sabesp and includes *estadual* issuers).
4. **controlador_tipo** — `soe` if soe_flag; else `foreign` if group HQ / controlling parent is outside Brazil (Valor `capital_origem` as hint, verified); else `listed` if CVM ATIVO; else `unlisted`. A Brazilian cia aberta with a foreign parent (Ambev, Telefônica, Neoenergia, CPFL, Claro) is `listed_flag=true` **and** `controlador_tipo=foreign`.
5. **freeze_status_hint** — `skip_soe` iff soe_flag; else `pending` (persons are ticket #25).

Natureza jurídica codes cited from RF: `2038` sociedade de economia mista; `2046` SA aberta; `2054` SA fechada; `2062` Ltda. `situacao_cadastral=2` on matriz = ativa.

---

## Counts

| metric | n |
|---|---|
| rows | 50 |
| with `cnpj_basico` + `cnpj_full` | 50 |
| CNPJ holes | **0** |
| `listed_flag=true` | 33 |
| `listed_flag=false` | 17 |
| `soe_flag=true` | **1** |
| `controlador_tipo=soe` | 1 |
| `controlador_tipo=listed` | 27 |
| `controlador_tipo=foreign` | 19 |
| `controlador_tipo=unlisted` | 3 |
| `freeze_status_hint=skip_soe` | 1 |
| `freeze_status_hint=pending` | 49 |

---

## SOE list (citations)

**Only Petrobras** is tagged `soe_flag=true` / `freeze_status_hint=skip_soe`.

### Petrobras (rank 1) — SOE

- **Carta Anual 2025 (ano-base 2024)**, local `/workspace/research/controllers/petrobras-carta-anual-2025.txt`: “sociedade de economia mista supervisionada pelo Ministério de Minas e Energia (MME)”; “A Petrobras é controlada pela União Federal, que detém diretamente **50,26% das ações ordinárias** e 29,02% do nosso capital social total” (posição 31 jan 2025).
- CVM `cad_cia_aberta`: CD_CVM **9512**, CNPJ 33.000.167/0001-01, SIT=ATIVO, CATEG_REG=Categoria A, **CONTROLE_ACIONARIO=ESTATAL HOLDING**.
- RF `br_me_cnpj.empresas`: `cnpj_basico=33000167`, razao `PETROLEO BRASILEIRO S A PETROBRAS`, **natureza=2038**, capital 205.43 bn.
- SEST/MGI Relatório Agregado das Empresas Estatais Federais 2025 (ano-base 2024) covers entities in which **União holds, directly or indirectly, the majority of voting capital**, and includes the Petrobras grupo.

Do **not** freeze CEO, finance minister, or CA chair. União is not a person.

### Explicitly **not** SOE (would have been easy to vibe-tag)

| group | why soe_flag=false | citation |
|---|---|---|
| **Eletrobras / Axia Energia** (36) | True corporation since 17 Jun 2022; 10% voting cap; União is **not** Art. 116 controller. CVM still says ESTATAL — **stale**. RF natureza=2046 not 2038. Same CNPJ 00.001.180/0001-26 now named AXIA ENERGIA S.A. at CVM. | https://ri.axia.com.br/a-axia/perfil-corporativo/ ; Axia Guia de Governança (“sem controlador definido”); AGU 26 Mar 2025 (3 CA seats for União by separate election, not majority AG). **Rejected** unrelated RF `AXIA ENERGIA S.A.` `59275417` capital R$ 1,000. |
| **Cemig** (37) | Controller is **Estado de Minas Gerais** (50.97% ON, Jul 2026), not União. Estadual economia mista (natureza 2038). Spec is federal/União. | https://ri.cemig.com.br/governanca-corporativa/composicao-acionaria ; Fato Relevante 2025-08-01 (“Estado de Minas Gerais, acionista controlador”). Ticket #25 must not emit a PF controlador. |
| **Sabesp** (43) | Privatized Jul 2024. IR 31/07/2026: Estado SP 18% + 1 PN golden share; Equatorial 15%; others 66.5%. CVM ESTATAL is **stale**. Natureza 2046. | https://ri.sabesp.com.br/governanca-corporativa/composicao-acionaria/ ; Agência Brasil 23 Jul 2024. |
| **Vibra** (5) | Ex-BR Distribuidora, now CVM PRIVADO, natureza 2046. | CVM CD_CVM 24295 CONTROLE_ACIONARIO=PRIVADO. |
| **CSN** (31) | Privatized 1993; CVM PRIVADO. | CVM CD_CVM 4030. |
| **Embraer** (45) | Privatized 1994; CVM PRIVADO. Golden share ≠ União majority. | CVM CD_CVM 20087. |
| **Acelen / Mataripe** (28) | Sold by Petrobras 30 Nov 2021 to Mubadala Capital / Acelen. | https://ri.acelen.com.br/mubadala-capital-assume-controle-da-refinaria/ |
| **CPFL** (33) | Controller = State Grid Corporation of China, not União. | CPFL RI estrutura acionária base 28/02/2026; https://www.grupocpfl.com.br/institucional/state-grid |
| **Neoenergia** (25) | Controller = Iberdrola S.A. (Spain). | Estatuto 17-04-2025; CVM IPE Iberdrola Energía as acionista controladora. |

BB, Caixa, BNDES/BNDESPAR are federal SOE peers in the spec but **are not in this Valor 1000 non-financial top 50**. They were not dropped; they simply are not in the 50.

---

## Listed vs unlisted

`listed_flag=true` (33) = CVM `SIT=ATIVO` on the row CNPJ.

Notable listed calls:

- **Claro Telecom Participações** (26) is CVM Categoria A ATIVO (CD_CVM 23531). Unusual for a telecom holding; flag follows CVM, not vibe.
- **BRF** (20) is Categoria **B** ATIVO — still listed.
- **Grupo Mateus** (50) is CVM Categoria A ATIVO (CD_CVM 25186) even though RF `natureza=2054` (fechada). **CVM wins**; RF natureza lags.
- **Atacadão / Carrefour Brasil** (9) was Categoria B; **cancelled 2025-12-22**. `listed_flag=false`. Source: CVM `DT_CANCEL=2025-12-22` + Valor 22 Dec 2025 (“deixa de ser companhia aberta”).

`listed_flag=false` (17): Cargill, Stellantis, Bunge (CVM cancel 2002-10-08), ArcelorMittal Brasil, Copersucar (cancel 2011-08-12), Mercado Livre BR Ltda, Shell Brasil, Cofco International Brasil, Acelen/Mataripe, Enel Brasil, Volkswagen do Brasil, Amaggi, LDC Brasil, Comexport, Honda South America, TAM (cancel 2012-07-18), Atacadão (cancel 2025-12-22).

---

## Foreign HQ (`controlador_tipo=foreign`, 19)

Valor `capital_origem` was a hint; each row cites a parent/HQ source. Brazilian CEO is not the default controller.

| rank | group | hint | verification |
|---|---|---|---|
| 9 | Carrefour/Atacadão | FR | CVM ESTRANGEIRO; 2025 delisting into wholly-owned sub of Carrefour S.A. (France) |
| 10 | Cargill | US | RF Ltda; parent Cargill, Incorporated (US) |
| 11 | Ambev | BE/BR | CVM ESTRANGEIRO HOLDING; Ambev RI: AB InBev “sede em Leuven, Bélgica”, 61.8% voting https://ri.ambev.com.br/governanca-corporativa/acordo-de-acionistas/ |
| 12 | Stellantis | HO | Stellantis N.V. corporate seat Amsterdam / office Hoofddorp https://www.stellantis.com/en/legal-notes |
| 15 | Bunge | SU | CVM listing cancelled 2002; bunge.com Contact Us: Global Headquarters Chesterfield MO (US) + Geneva office. Valor SU vs current US HQ page — both non-BR. |
| 17 | ArcelorMittal Brasil | EP | SA fechada, no CVM ATIVO; Brazilian operating company of ArcelorMittal group |
| 19 | Mercado Livre | AG | Brazilian Ltda of MercadoLibre group (Argentina parent / NASDAQ MELI) |
| 21 | Telefônica Brasil | EP | B3 CodCVM=17671 posição 28/04/2025: Telefónica S.A. 38.91% + TLH S.L. 37.34%; Moody's Local 09/05/2025: parent sede na Espanha |
| 22 | Shell | HO | Shell Brasil Petróleo Ltda; parent Shell plc |
| 23 | Cofco | HK | COFCO International Brasil S.A. fechada; Chinese COFCO group (HK hint) |
| 25 | Neoenergia | EP/BR | Iberdrola S.A. (Spain) controladora; ~83.8% after Previ sale 31 Oct 2025 |
| 26 | Claro | MX | América Móvil group; CVM listed holding |
| 28 | Acelen | EA | Mubadala Capital / Mubadala Investment Company, Abu Dhabi |
| 30 | Enel | IT | Enel Américas (Chile) 100% voting of Enel Brasil (Relatório Administração 2022); Enel S.p.A. Rome |
| 32 | Volkswagen | AL | Volkswagen AG (Alemanha) |
| 33 | CPFL | CH | State Grid Corporation of China via SGBP/ESC; 83.7% |
| 39 | LDC | FR | Louis Dreyfus Company Brasil S.A. fechada |
| 46 | Honda | JP | Honda South America Ltda; Honda Motor Co. Japan |
| 47 | Latam/TAM | BR/CL | TAM S.A. CVM cancelled 2012; parent LATAM Airlines Group (Chile) |

**Raízen** (3) has Valor `BR/GB/HO` (Cosan+Shell JV) but the issuer is a Brazilian cia aberta with RJ HQ → `controlador_tipo=listed`. FRE 6.1 of Raízen S.A. is the #25 door.

---

## Unlisted Brazilian (`controlador_tipo=unlisted`, 3)

- Copersucar S.A. (18) — CVM cancel 2011-08-12; RF 10265949 SA fechada.
- André Maggi Participações S.A. (35) — RF 04786144 SA fechada, MT.
- Comexport Companhia de Comércio Exterior (44) — RF 43633296 SA fechada, capital R$ 2 bn.

#25 may freeze a PF only if a **public act** names an Art. 116 controller. QSA is sócio, never dono/UBO. Else visible hole.

---

## CNPJ matching notes (no holes; rejected candidates)

All 50 matched. None invented. Matriz `cnpj_full` from `estabelecimentos` `identificador_matriz_filial='1'`.

| rank | kept | rejected / caution |
|---|---|---|
| 2 JBS | CVM/BD **02916265** `JBS S/A` natureza 2046 capital 23.6 bn | BD exact `JBS S.A.` **07452328** natureza 2054 capital **0** — wrong company |
| 5 Vibra | 34274233 `VIBRA ENERGIA S.A` | RF spelling lacks second period |
| 9 Atacadão | 75315333 exact `ATACADAO S.A.` capital 17.3 bn | `ATACADAO SA%` LIKE hits hundreds of unrelated shops |
| 10 Cargill | 01961898 `CARGILL ALIMENTOS LTDA` 9.5 bn | `CARGILL ALIMENTOS COMPLETOS LTDA` 50478658 |
| 13 Braskem | 42150391 `BRASKEM S.A` (one period) = CVM 42.150.391/0001-70 | QPAR / GREEN / PETROQUIMICA / PARTICIPACOES |
| 17 ArcelorMittal | 17469701 SA fechada 18.8 bn | ACOS E METAIS LTDA; SSC PARTICIPACOES |
| 19 Mercado Livre | 03361252 exact Valor name | `... INTERNET 2 LTDA` 46758492; dozens of `MERCADO LIVRE *` shops |
| 23 Cofco | **06315338** natureza 2054 capital 6.55 bn | same razao with natureza **4120** capital 0 (61088385, 62329949, 63090486) |
| 24 Rede D'Or | 06047087 listed issuer | SERVICOS MEDICOS LTDA 14017359 |
| 30 Enel | 07523555 `ENEL BRASIL S.A` 52.5 bn | ENEL BRASIL INVESTIMENTOS SUDESTE |
| 31 CSN | 33042730 | CSN Mineração 08902291 (listed sub) |
| 36 Eletrobras/Axia | **00001180** RF still ELETROBRAS; CVM denom AXIA ENERGIA S.A. | `AXIA ENERGIA S.A.` **59275417** capital R$ 1,000 |
| 44 Comexport | 43633296 `COMEXPORT COMPANHIA DE COMERCIO EXTERIOR` 2 bn | many zero-capital COMEXPORT * Ltda |
| 46 Honda | 43149806 exact Valor name | capital only R$ 119 m vs R$ 35 bn group revenue — likely regional holding; **not** swapped for Honda Automóveis without Valor naming it |
| 47 TAM | 01832635 `TAM S/A.` | CVM cancel 2012; still the Valor razao |

LIKE-prefix search without exact+CVM is unsafe (`ATACADAO`, `VALE SA`, `MARFRIG`, `MERCADO LIVRE`).

---

## Banks

Valor 1000 non-financial ranking: **no bank in this 50**. Spec said not to drop banks if present; none to tag as `setor=financeiro` here.

---

## Files

- `/workspace/valor1000-2025-top50-flags.csv` (UTF-8)
- `/workspace/valor1000-2025-top50-flags.json` (UTF-8)
- this notes file

`retrieved_at=2026-08-24` on every row. Persons / freeze CSV are out of scope.
