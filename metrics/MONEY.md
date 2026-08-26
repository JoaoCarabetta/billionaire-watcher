# Dinheiro sob controle

Arquivo cívico de poder econômico. Não é ranking Forbes. Não é terminal de investimento.

O comando lê `grafo-publico.json` (`nodes` + `edges`) do tamanho que o arquivo tiver, mais linhas de preço datado. Não há constante de tamanho de grafo. A mesma invocação vale quando o grafo crescer.

## Como rodar

Na raiz do repositório:

```sh
npm run money -- public/grafo-publico.json
```

JSON completo:

```sh
npm run money -- public/grafo-publico.json --json
```

Uma data (Energisa, 21 August 2026):

```sh
npm run money -- public/grafo-publico.json --date 2026-08-21
```

Preços e quantidades padrão: `transform/seeds/listed_prices_fixture.csv` + `transform/seeds/energisa_edges_fixture.csv`.

Fixture mínima (algoritmo, testes):

```sh
npx vitest run test/grafo-money.test.ts
```

## O que cada coluna significa

- **V** — valor listado naquela data: soma dos produtos de classe (quantidade × preço) da cia aberta. Join: primeiros 8 dígitos do CNPJ de 14 dígitos no JSON = `cnpj_basico` do armazém. Energisa `00864214000106` → `00864214`.
- **slice_capital / slice_votos** — fatia citada em caminhos completos, agrupada pelo último salto (linha FRE de entrada na semente). Caminho com buraco não entra. Outros e tesouraria não entram.
- **economic** — `V × slice_capital`. Pretensão sobre o valor de equity listado naquela data.
- **control** — `V × slice_votos`. Os mesmos reais como unidade de poder de voto. Não é caixa. É dinheiro sob controle.
- **Person total** — soma dos grupos de último salto daquela pessoa naquela semente. O salto direto é **um** grupo, não o total. Produto através de um holding; não se toma o holding a 100%.
- **nested / via_last_hop / parent_on_same_seed** — pessoa através de um holding e o holding na mesma semente. Não some. O helper `sumNodeTotalsIfNotNested` recusa esse par.

## Nested, não aditivo

Ivan Müller Botelho através da Gipar é um grupo de último salto. A Gipar tem o próprio total na Energisa (linha FRE dela). Não some o total da Gipar em cima do person total do Ivan: aqueles reais da Gipar já contêm o grupo Ivan-através-da-Gipar.

## O que não dá para precificar

- Veículos não listados (Gipar, Nova Gipar, Itacatu, Multisetor, LTD, …): não têm V. Só entra a fatia citada de uma semente listada que tenha cotação de arquivo.
- Outras cias abertas: **Energisa-only until issue 123** (cotações reais Brasil Bolsa Balcão no armazém). Issue 115 / PR 120 é *recorded fixture quote* (teste). Não é valor de arquivo. Vale, WEG, Ambev e o restante não recebem coluna de dinheiro neste PR.
- Buraco no caminho: sem dinheiro naquele caminho.
- Outros e tesouraria: sem dinheiro.
- Cotistas de fundo: não estão no arquivo.
- Cadastro de Pessoas Físicas. Pessoa = `p-` + oito hex + nome de exibição.
- Rateio igualitário de buracos ou de Outros.
- Soma publicada de pessoa + holding na mesma semente.

Wealth REFUSED.

## Testes

```sh
npx vitest run test/grafo-money.test.ts
```
