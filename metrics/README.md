# Métricas de relevância do grafo de controle

Arquivo cívico de poder econômico. Não é ranking Forbes. Não é terminal de investimento.

Os scripts leem `grafo-publico.json` (`nodes` + `edges`) do tamanho que o arquivo tiver. Não há constante de 11, 31, 403 ou 492 nós. Sementes listadas vêm de `LISTED_COMPANY_IDS` em `src/lib/grafo-panel.ts` e de qualquer nó que o JSON marque (`listed: true` ou `kind: listed`).

## Como rodar

Na raiz do repositório:

```sh
npm run metrics -- public/grafo-publico.json
```

JSON completo:

```sh
npm run metrics -- public/grafo-publico.json --json
```

Fixture mínima (testes):

```sh
npm run metrics -- metrics/fixtures/tiny-graph.json
```

O mesmo comando vale quando o grafo crescer (árvores Valor 50, depois arquivos do tamanho WEG). Sem mudança de código.

## O que cada métrica significa

1. **Grau de saída e grau de saída ponderado** — quantas empresas um nó controla direto; a soma ponderada usa só arestas com percent cited (capital e votos separados). Aresta-buraco não entra na soma.
2. **Sementes listadas alcançadas** — quantas cias abertas-semente o nó alcança no grafo dirigido (dono → detido), com ou sem percent.
3. **Fatia citada em caminho completo** — produto dos percents citados em um caminho em que todo salto tem percent. Salto sem percent: caminho incompleto, sem produto, sem rateio.
4. **Betweenness dirigida** — Brandes sem peso no grafo de controle. Articulação foi dropada: em árvores de controle quase todo holding interno é articulação; isso não é sinal cívico além de “não é folha”.
5. **Origem do capital citado nas sementes** — arestas diretas cited para as listadas, classificadas em estrangeiro (`x-`) / União-estado / pessoa / empresa brasileira / tesouraria / outros / **missing**. Caminho multi-salto só quando todo salto é cited; o resto fica missing ou unattributed. Missing não é Outros.
6. **Pessoas em mais de um caminho de semente** — pessoas que alcançam mais de uma semente listada no grafo dirigido.
7. **Poder, não rico** — `power_score = seeds_reached + weighted_out_capital / 100`. O script recusa ranking de fortuna.

## O que não medimos

- Fortuna, patrimônio, “quem é o mais rico”. Só há fatias de salto cited em caminhos completos.
- UBO completo. A caminhada para em buracos, outros, tesouraria, folhas `x-` e empresas sem QSA neste arquivo.
- Cotistas por trás de gestoras. Alaska, Dynamo e afins são nós empresa; sócios no painel não viram pessoa nova aqui.
- Rateio igualitário de buracos. Residual = `max(0, 100 − soma cited de entrada)`. É o balde **missing**, nunca Outros.
- Cadastro de Pessoas Físicas. Pessoa = `p-` + oito hex + nome de exibição.
- Empresas que não estão neste JSON / nesta página.

Limite de citação: número só em caminho com todos os percents publicados.

## Tipos que o arquivo sustenta

Derivados de id/rótulo e da lista de sementes do repositório, sem congelar Energisa/Vale/…:

| tipo | como detectar |
| --- | --- |
| listed seed | `LISTED_COMPANY_IDS` ∩ nós do arquivo, ou `listed: true` / `kind: listed` |
| person | `kind: person` ou id `p-` + oito hex |
| tesouraria | prefixo `tesouraria-` ou rótulo de ações em tesouraria |
| outros | prefixo `outros-` ou rótulo Outros acionistas |
| foreign | prefixo `x-` (folha estrangeira do freeze) |
| state | rótulo União Federal, `Estado de …`, Secretaria da Fazenda do Estado |
| company | o restante das empresas |

Holding/veículo, gestora/fundo e empresa-buraco da Receita **não** são um campo neste JSON: entram como `company`, salvo os prefixos acima. Tesouraria e outros são folhas.

Direção da aresta (verificada no arquivo): `from` = dono, `to` = detido. `pct_capital` e `pct_votos` existem em arestas cited e estão ausentes em arestas-buraco.

## Testes

```sh
npx vitest run test/grafo-metrics.test.ts
```
