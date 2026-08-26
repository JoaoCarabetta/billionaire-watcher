# Dinheiro sob controle

Arquivo cívico de poder econômico. Não é ranking Forbes. Não é terminal de investimento.

O comando lê `grafo-publico.json` (`nodes` + `edges`) do tamanho que o arquivo tiver, mais linhas de preço datado. Não há constante de tamanho de grafo. A mesma invocação vale quando o grafo crescer.

## Como rodar

Na raiz do repositório (Brasil Bolsa Balcão, 2025-05-16):

```sh
npm run money -- public/grafo-publico.json
```

JSON completo:

```sh
npm run money -- public/grafo-publico.json --json
```

Data explícita:

```sh
npm run money -- public/grafo-publico.json --date 2025-05-16
```

## Fonte de preço (issue #123, Brasil Bolsa Balcão 2025-05-16)

Prices are **#123** (merged PR 125): `transform/seeds/b3_listed_prices.csv` only. Unadjusted PREULT from B3 COTAHIST_A2025.ZIP. Source label **Brasil Bolsa Balcão**. Date on every money row: **2025-05-16**. Default is not `listed_prices_fixture.csv`. Recorded fixture quotes are skipped and never printed.

- Energisa: **ENGI3** 12.21 and **ENGI4** 8.50 × `graph_edges` / Energisa edges fixture quantities (609526325 ordinary, 89144004 preferred; Energisa IR 14 Aug 2026 table 6.1).
- **ENGI11** is a unit. No money without a unit quantity. The script does not invent that quantity.
- Every other listed seed with a B3 quote **and** a quantity gets money (32 seeds this run). Quantities: CVM FRE item 17.1 on or before the quote date (`metrics/listed_capital_quantities.csv`). Quote without quantity → no money.
- Claro Telecom Participações (`cnpj_basico` 07043628): no Bolsa class; omitted.

Energisa V from the command = **8200040462.25** (ENGI3 12.21 × 609526325 + ENGI4 8.50 × 89144004).

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
- Cotação B3 sem quantidade: sem dinheiro (não se inventa número de ações).
- ENGI11 sem quantidade de unit: sem dinheiro.
- Claro: sem classe na Bolsa.
- Buraco no caminho: sem dinheiro naquele caminho.
- Outros e tesouraria: sem dinheiro.
- Cotistas de fundo: não estão no arquivo.
- Cadastro de Pessoas Físicas. Pessoa = `p-` + oito hex + nome de exibição.
- Rateio igualitário de buracos ou de Outros.
- Soma publicada de pessoa + holding na mesma semente.

Wealth REFUSED.

## Worked example (from `npm run money -- public/grafo-publico.json`)

IVAN MÜLLER BOTELHO `p-cdbc8c4e` → ENERGISA S.A. `00864214000106` on 2025-05-16.

Brasil Bolsa Balcão. ENGI3 12.21 and ENGI4 8.50 × graph_edges quantities.

V = 8200040462.25 reais.

Last-hop groups (command output):

- self (direct FRE): 0.387% capital / 0.208% votes → economic 31734156.59 / control 17056084.16
- Multisetor: 0.235% / 0.156% → 19270758.47 / 12789302.17
- Itacatu: 0.011% / 0.006% → 876880.27 / 501074.44
- Gipar: 15.226% / 34.950% → 1248576860.03 / 2865925764.20 (product; he does not take Gipar at 100%)

Person total (sum of groups): 15.859% capital / 35.320% votes → economic 1300458655.36 reais (1.30 billion reais); control 2896272224.98 reais (2.90 billion reais).

Do not add Gipar 2.18 billion economic / 5.02 billion control on top of Ivan 1.30 / 2.90. Those Gipar reais already contain Ivan-through-Gipar.

## Testes

```sh
npx vitest run test/grafo-money.test.ts
```
