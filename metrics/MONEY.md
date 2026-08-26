# Dinheiro sob controle

Arquivo cívico de poder econômico. Não é ranking Forbes. Não é terminal de investimento.

O comando lê `grafo-publico.json` (`nodes` + `edges`) do tamanho que o arquivo tiver, mais linhas de preço datado. Não há constante de tamanho de grafo. A mesma invocação vale quando o grafo crescer.

## Como rodar

Na raiz do repositório (latest Energisa fixture date, 2026-08-21):

```sh
npm run money -- public/grafo-publico.json
```

JSON completo:

```sh
npm run money -- public/grafo-publico.json --json
```

Data explícita:

```sh
npm run money -- public/grafo-publico.json --date 2026-08-21
```

As duas datas da fixture como duas linhas (append-by-day; inclui 2026-08-20):

```sh
npm run money -- public/grafo-publico.json --all-dates
```

## Fonte de preço (fixture de teste)

Não é pull ao vivo da Bolsa. Não é linha confirmada no BigQuery.

- Preços: Energisa *test fixture* (hoje em `transform/seeds/listed_prices_fixture.csv`, ticker **ENGI**). Latest `preco_date` **2026-08-21**: ordinária 45.75, preferencial 43.10.
- Quantidades: `transform/seeds/energisa_edges_fixture.csv` — 609526325 ordinárias, 89144004 preferenciais (Energisa IR 14 Aug 2026 table 6.1).
- V = 45.75 × 609526325 + 43.10 × 89144004 = **31727935941.15**.

O comando sem `--date` e sem `--all-dates` usa só essa data latest. 2026-08-20 só entra se `--all-dates` (duas linhas) ou `--date 2026-08-20`.

## O que cada coluna significa

- **V** — valor listado naquela data: soma dos produtos de classe (quantidade × preço) da cia aberta. Join: primeiros 8 dígitos do CNPJ de 14 dígitos no JSON = `cnpj_basico`. Energisa `00864214000106` → `00864214`.
- **slice_capital / slice_votos** — fatia citada em caminhos completos, **agrupada pelo último salto** (linha FRE de entrada na semente). Não é a soma de todos os caminhos simples (isso duplicaria Ivan através da Gipar). Caminho com buraco não entra. Outros e tesouraria não entram.
- **economic** — `V × slice_capital`. Pretensão sobre o valor de equity listado naquela data.
- **control** — `V × slice_votos`. Os mesmos reais como unidade de poder de voto. Não é caixa. É dinheiro sob controle.
- **Person total** — soma dos grupos de último salto daquela pessoa naquela semente. O salto direto é **um** grupo, não o total. Produto através de um holding; não se toma o holding a 100%.
- **nested / via_last_hop / parent_on_same_seed** — pessoa através de um holding e o holding na mesma semente. Não some. O helper `sumNodeTotalsIfNotNested` recusa esse par.

## Nested, não aditivo

Ivan Müller Botelho através da Gipar é um grupo de último salto. A Gipar tem o próprio total na Energisa (linha FRE dela). Não some o total da Gipar em cima do person total do Ivan: aqueles reais da Gipar já contêm o grupo Ivan-através-da-Gipar.

## O que não dá para precificar

- Veículos não listados (Gipar, Nova Gipar, Itacatu, Multisetor, LTD, …): não têm V. Só entra a fatia citada de uma semente listada precificada.
- Outras cias abertas: **ficam sem dinheiro**. Não esperar a issue 115. Data Engineer é dono da 115. Issue 115 / PR 120 é *recorded fixture quote* (teste). Não é valor de arquivo. Vale, WEG, Ambev e o restante não recebem coluna de dinheiro neste PR.
- Buraco no caminho: sem dinheiro naquele caminho.
- Outros e tesouraria: sem dinheiro.
- Cotistas de fundo: não estão no arquivo.
- Cadastro de Pessoas Físicas. Pessoa = `p-` + oito hex + nome de exibição.
- Rateio igualitário de buracos ou de Outros.
- Soma publicada de pessoa + holding na mesma semente.

Wealth REFUSED.

## Worked example (from `npm run money -- public/grafo-publico.json --date 2026-08-21`)

IVAN MÜLLER BOTELHO `p-cdbc8c4e` → ENERGISA S.A. `00864214000106` on 2026-08-21.

Energisa test fixture, ticker ENGI. Not a live Bolsa pull. Not a confirmed BigQuery row.

V = 31727935941.15 reais (ON 45.75 × 609526325 + PN 43.10 × 89144004).

Last-hop groups:

- self (direct FRE): 0.387% capital / 0.208% votes → economic 122787112.09 / control 65994106.76
- Multisetor: 0.235% / 0.156% → 74563216.25 / 49484897.27
- Itacatu: 0.011% / 0.006% → 3392861.45 / 1938777.97
- Gipar: 15.226% / 34.950% → 4831045263.12 / 11088958582.26 (product; he does not take Gipar at 100%)

Person total (sum of groups): 15.859% capital / 35.320% votes → economic 5031788452.91 reais (5.03 billion reais); control 11206376364.26 reais (11.21 billion reais).

Do not add Gipar 8.45 billion economic / 19.41 billion control on top of Ivan 5.03 / 11.21. Those Gipar reais already contain Ivan-through-Gipar.

## Testes

```sh
npx vitest run test/grafo-money.test.ts
```
