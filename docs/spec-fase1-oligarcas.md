# Especificação — Fase 1: quem são os oligarcas

Decisões de produto travadas em 27 de agosto de 2026 (João). Este documento é a
fonte de verdade do novo armazém (warehouse). A camada antiga de dbt (freeze,
hops, valor-universo, person-money, facts) foi removida do repositório junto com
esta especificação; a implementação do pipeline descrito aqui é trabalho futuro,
fora do PR que introduz este arquivo.

O grafo v0 congelado vive em `graph/grafo-publico.json`. Ele **não** é fonte de
verdade do novo pipeline.

## Problema

O arquivo quer responder, com fontes citáveis, à pergunta de Jeffrey Winters:
quem são os oligarcas — pessoas naturais cuja posição material em empresas lhes
dá poder de defesa da riqueza. A fase 1 responde apenas **quem são**. A fase 2
(influência sobre o Estado) fica fora deste documento.

O armazém antigo não respondia essa pergunta. Ele codificava outra identidade:

- **semente-como-oligarca**: os cinquenta grupos da Valor 1000 viravam a própria
  definição (`freeze_cnpj_basicos`, `freeze_persons`, `top50_flags_seed`);
- **grafo valor-universo / hops**: extratos de hop por empresa da revista
  (`valor_universo_hop_roots`, `valor_universo_fre_hops`, o JSON de 2189 nós e o
  grafo de hops da issue #174) sem grão de pessoa;
- **person-money**: dinheiro sob controle por nó do grafo público
  (`graph_person_holdings`, `graph_listed_prices`), acoplado ao grafo v0;
- listas fechadas ad-hoc (`vehicle_cnpj_basicos`, `holding_invert_cnpj_basicos`,
  `gestora_cnpj_basicos`) que não compunham uma definição.

Uma revista é uma lista de partida, não a definição de oligarca. A definição
precisa ser um critério documental verificável por qualquer pessoa.

## Solução

Três tabelas finais, com grão travado, alimentadas por uma porta de empresas
(semente A ∪ B), uma caminhada de propriedade para cima até pessoa natural, e um
único hop de inversão para baixo a partir de quem já é oligarca:

- `empresas` — uma linha por empresa;
- `pessoas` — uma linha por pessoa natural (`e_oligarca` fica para a próxima passagem);
- `vinculos` — uma aresta de caminho (pessoa, empresa ou estado → empresa),
  incluindo sócios sem rótulo de controlador. Sem colunas `via`.

`e_oligarca` é verdadeiro para a pessoa natural citada com
`Acionista_Controlador` = `S` **ou** com pelo menos 10% das ações ordinárias
(`Percentual_Acao_Ordinaria_Circulacao` ≥ 10) em pelo menos uma firma da
semente A ∪ B. Essa citação lê `int_vinculo_propriedade` (grão FRE da
emissora), não o mart de caminho. O piso de tamanho **não** entra nessa flag:
a valoração pode melhorar depois sem mudar quem é oligarca.

A unidade é a pessoa natural. Família é uma camada posterior, fora desta
especificação.

## User stories

- Como leitor do arquivo, quero ver por que uma pessoa é marcada oligarca — o
  documento (Formulário de Referência da Comissão de Valores Mobiliários ou
  Quadro de Sócios da Receita Federal), a empresa e o percentual — para checar
  o critério eu mesmo.
- Como jornalista, quero a lista de pessoas com `e_oligarca` = verdadeiro e as
  empresas que as qualificam, para investigar a partir de um critério estável e
  não de uma lista de revista.
- Como mantenedor do pipeline, quero que a definição de oligarca seja uma
  expressão sobre colunas nomeadas de fontes públicas, para que uma atualização
  anual dos arquivos-fonte reproduza a tabela sem julgamento manual.
- Como pesquisador, quero `empresas` com Cadastro Nacional da Pessoa Jurídica de
  14 dígitos e piso de tamanho rotulado por fonte, para cruzar com outras bases
  sem reinventar chaves.
- Como revisor, quero que homônimos sem CPF permaneçam linhas separadas em
  `pessoas`, para nunca atribuir empresa de um João Silva a outro.

## Decisões de implementação

### Esquema das três tabelas

Todos os identificadores de empresa são cadeias de dígitos (STRING), nunca
inteiros; zeros à esquerda são preservados (`lpad`). Macros genéricas mantidas
do projeto dbt (`digits_only`, `prefix8_from_cnpj14`, `normalize_company_name`,
`normalize_person_name`, `person_id_from_cpf`) continuam válidas.

#### `empresas` — uma linha por empresa

| coluna | tipo | descrição |
|---|---|---|
| `cnpj` | STRING(14), PK | 14 dígitos; nunca inventar sufixo `/0001`. Nesta passagem (só semente A) não é nulo |
| `razao_social` | STRING | razão social da Receita do `cnpj_basico` casado; senão a razão publicada na fonte que a trouxe |
| `capital_social` | FLOAT64, nullable | `capital_social` da Receita para esse `cnpj_basico`, em reais |
| `motivo_entrada_categoria` | STRING | `semente`, `subida` (holding intermediária citada na caminhada para cima) ou `hop` (inversão para baixo). Nesta passagem `semente` ou `subida` |
| `motivo_entrada_descricao` | STRING | citação da fonte que a trouxe, p.ex. `Valor 1000 2025, ranking industrial, posição 1` |
| `motivo_entrada_date` | DATE | data da fonte que justificou a entrada (semente A: publicação do Valor 1000 2025, `2025-09-16`) |

O piso **não é porta**: empresa sem piso continua na tabela e continua
caminhando. O piso só existe para ordenar e para a estimativa de fortuna.

#### `pessoas` — uma linha por pessoa natural

| coluna | tipo | descrição |
|---|---|---|
| `pessoa_id` | STRING, PK | `normalize_person_name` dobra acento e hífen. CPF de 11 dígitos → `person_id_from_cpf` (`p-` + 8 hex de sha256). Máscara CVM/QSA cola nesse `p-` se `(nome, 6 dígitos)` ou `(primeiro+último token, 6 dígitos)` aponta para **exatamente um** CPF. Nome dobrado com um único CPF no armazém usa esse `p-` em qualquer empresa. Sem CPF: proximidade (edição ≤ 2 no mesmo número de tokens, ou contenção com o menor nome ≥ 3 tokens) só contra um CPF no bloco primeiro+último. Senão, 3+ tokens ou 2 tokens com a mesma máscara → `nome:` + chave; 2 tokens sem documento comum → `nome:` + chave + `@` + CNPJ |
| `nome` | STRING | nome como citado na fonte (FRE preferido se ambos citam) |
| `cpf` | STRING(11), nullable | **somente armazém**; só 11 dígitos; nunca a máscara; nunca emitir CPF de 11 dígitos em HTML público |

Nesta passagem não há `e_oligarca`, `filiacao`, `data_nascimento` nem fortuna.
Não fundir homônimos curtos sem documento comum: duas `MARIA SILVA` sem
máscara igual continuam duas linhas. A mesma máscara (ou o mesmo CPF) em
empresas diferentes é a mesma pessoa. Máscara sozinha não gera `p-` — só
cola num CPF já citado. Estado não entra em `pessoas`.

#### `vinculos` — uma aresta de caminho

Substitui `pessoas_empresas`. Grão de **caminho**: pessoa no veículo mais
interno, empresa→empresa só quando o FRE/QSA declara dona, estado→empresa.
Não há colunas `via` / `via_cnpj`. `Acionista_Relacionado` fica em
`int_vinculo_propriedade`. Pessoa citada na emissora “via” um veículo some
dessa emissora e liga no veículo (percentual da emissora **não** copia; se
o livro do veículo já tem a pessoa, fica essa linha). Empresa que já é dona
do `via` (fotocópia do bloco) some. `via` de acordo (origem não dona do
relacionado) permanece na emissora. `via` sem CNPJ resolvido permanece.
Outros / tesouraria / estrangeiro / não resolvido ficam visíveis.

| coluna | tipo | descrição |
|---|---|---|
| `origem_tipo` | STRING | `pessoa`, `empresa`, `estado`, `outros`, `tesouraria`, `estrangeiro`, `nao_resolvido` |
| `origem_id` | STRING | `pessoa_id`; CNPJ 14 da holding; CNPJ do ente ou `estado:` + nome; `outros` / `tesouraria` levam `@` + CNPJ da emissora (um nó por empresa); prefixo do tipo nos demais |
| `origem_nome` | STRING | nome como citado |
| `origem_documento` | STRING, nullable | somente armazém; `CPF_CNPJ_Acionista` ou QSA `documento` |
| `cnpj` | STRING(14) | destino da aresta (emissora ou veículo) |
| `papel` | STRING | `acionista_controlador` (FRE `S`), `acionista` (outro FRE) ou `socio` (todo QSA) |
| `fonte` | STRING | `fre` ou `qsa` |
| `acionista_controlador` | BOOL, nullable | do Formulário: `Acionista_Controlador` = `S`/`N`; nulo para Receita |
| `participante_acordo_acionistas` | BOOL, nullable | do Formulário: `Participante_Acordo_Acionistas` = `S`/`N` |
| `percentual_on` | FLOAT, nullable | `Percentual_Acao_Ordinaria_Circulacao`; nulo para Receita e para aresta inventada no veículo — nunca inventar |
| `percentual_total` | FLOAT, nullable | `Percentual_Total_Acoes_Circulacao` |
| `qualificacao` | STRING, nullable | código de qualificação do sócio na Receita |
| `tem_informacao_de_controle` | BOOL | verdadeiro no FRE; falso no QSA |
| `data_referencia` | DATE | `Data_Referencia` do Formulário ou partição `data` da Receita |
| `fonte_documento` | STRING | citação exata desta linha |

FRE e QSA são sempre unidos na mesma empresa. Sócio da Receita nunca vira
controlador.

### A flag `e_oligarca`

`e_oligarca` = verdadeiro se e somente se existe pelo menos uma linha em
`int_vinculo_propriedade` (origem pessoa) em que:

1. o `cnpj` da linha (emissora que citou) pertence à semente A ∪ B (não a
   empresa que entrou por `subida` ou `hop`); e
2. o vínculo vem do Formulário de Referência com `Acionista_Controlador` = `S`,
   **ou** `Percentual_Acao_Ordinaria_Circulacao` ≥ 10.

O piso de tamanho não participa. Empresas de hop não mintam oligarcas novos.
Vínculo `socio` da Receita não mintam oligarcas (não há controle nem percentual
na Receita).

### Estimativa de fortuna (incompleta, rotulada)

`fortuna_valor` = soma de participação × valor da empresa **apenas ao longo de
caminhos completos e citados**: cada aresta do caminho precisa de percentual
citado e a empresa-folha precisa de `tem_piso` = verdadeiro. Faltou percentual
em qualquer aresta, aquele caminho não soma e `fortuna_incompleta` fica
verdadeiro. Não inventar participações ausentes. Melhorar a valoração depois
não muda quem é oligarca.

### Semente A ∪ B (porta de empresas)

Chave de deduplicação entre A e B: Cadastro Nacional da Pessoa Jurídica com 14
dígitos, somente dígitos.

**A — inventário Valor (lista de partida, não definição).** O CSV de controle
da caminhada já versionado no repositório, `data/controle-empresas-walk.csv`
(~652 linhas): ranking industrial Valor 1000 2025 posições 1–500 ∪ bancos 2025 ∪
seguradoras 2025, mais os extras nomeados Itaúsa e Folha. Fontes originais em
`data/valor1000-2025/ranking.csv`, `data/valor1000-2025/bancos.csv` e
`data/valor1000-2025/seguradoras.csv`. Grupos fechados Folha, Globo, Havan e
Record, e a Natura sem CNPJ, ficam **somente em A** com `nao_caminha` =
verdadeiro: não caminham nem para cima nem para baixo.

**B — união de três cadastros oficiais:**

1. **Comissão de Valores Mobiliários — companhias abertas.** Arquivo
   `cad_cia_aberta.csv` em
   `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv`
   (latin-1, `;`). Filtro `SIT` = `ATIVO` (757 linhas na apuração de agosto de
   2026). Chave `CNPJ_CIA`. Atenção: `CONTROLE_ACIONARIO` vale
   `PRIVADO`/`ESTATAL`/`ESTRANGEIRO` — é o tipo de controle, **não** a pessoa
   controladora.
2. **Banco Central — entidades supervisionadas (Unicad).** Serviço OData
   `https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata/EntidadesSupervisionadas(dataBase=@dataBase)`
   com `@dataBase='MM-DD-YYYY'`. Filtros:
   `codigoTipoSituacaoPessoaJuridica` = 3 (em funcionamento) e
   `codigoTipoEntidadeSupervisionada` em {2, 4, 5, 6, 7, 8, 13, 28, 39};
   excluir explicitamente os tipos 3, 9 e 11. Chave da instituição é
   `codigoCNPJ8` (8 dígitos); o identificador da linha é `codigoCNPJ14`
   terminando em `0001`. Verificação nomeada `SedesBancoComMultCE`: a contagem
   de sedes dos tipos Banco Comercial, Banco Múltiplo e Caixa Econômica na
   data-base de referência deve dar 154.
3. **Superintendência de Seguros Privados — cadastro.** Serviço OData
   `https://dados.susep.gov.br/olinda/servico/empresas/versao/v1/odata/DadosCadastrais`,
   **dump completo sem `$top`** (o parâmetro `$top` responde erro 500 neste
   serviço). Filtro `mercodigo` em {1, 2, 3, 4, 6}. Chave `entcgc` (CNPJ).
   362 linhas no total na apuração de referência.

### Colunas de tamanho (piso, não porta)

Três fontes, uma por família, gravadas em `valor_do_piso` / `fonte_do_piso` /
`tem_piso`:

- **Bolsa** (`fonte_do_piso` = `bolsa_cotahist`): valor de mercado = quantidade
  de ações × preço de fechamento.
  - Universo e CNPJ: API de listadas da B3,
    `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetInitialCompanies/{payload}`
    com type=1, campo `cnpj` (o `{payload}` é o JSON de parâmetros codificado em
    base64).
  - Quantidades de ações:
    `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/{payload}`.
  - Preço: COTAHIST anual
    `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A2026.ZIP`,
    registros com `TPMERC` = 010 (mercado a vista, lote-padrão) e `CODBDI` = 02,
    campo `PREULT` (fechamento oficial, dividir por 100).
  - Junção ticker→CNPJ pelo Formulário Cadastral da Comissão:
    `fca_cia_aberta_valor_mobiliario_2026.csv` dentro de
    `fca_cia_aberta_2026.zip` (dataset
    `https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca`), coluna
    `Codigo_Negociacao` = `CODNEG` do COTAHIST.
  - Cobertura esperada: cadastro CVM `ATIVO` ∩ ticker negociado ≈ 336 CNPJs.
- **Banco** (`fonte_do_piso` = `ifdata_ativo_total`): IF.data OData
  `https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/IfDataValores(AnoMes=@AnoMes,TipoInstituicao=@TipoInstituicao,Relatorio=@Relatorio)`
  com `Relatorio` = `'2'`, linha `Conta` = `140220` (Ativo Total), campo
  `Saldo`. Junção com a semente pelo `codigoCNPJ8`. **Um grão só**: escolher
  prudencial **ou** individual e documentar; nunca misturar os dois.
- **Seguradora** (`fonte_do_piso` = `susep_premios_emitidos`): Olinda SUSEP
  `https://dados.susep.gov.br/olinda/servico/receitasoperacionais/versao/v1/odata/ReceitasSeguros(Ano=@Ano)`,
  campo `valor` (prêmios emitidos). **Não** usar `premio_ganho` do SES
  (`Ses_seguros`) a menos que seja documentado como outra conta contábil.

### Caminhada (walk)

#### Para cima (subida)

De cada empresa em A ∪ B (exceto `nao_caminha`), subir a propriedade até chegar
a pessoa natural **ou ao Estado**, ou parar em: acionista `Outros`, ações em
tesouraria, sócio estrangeiro sem CNPJ, ou nome de PJ sem casamento único na
Receita. Não parar em holding / controlador pessoa jurídica (Itaúsa, J&F,
BNDESPAR, Petrobras, BB): esses entram em `empresas` com
`motivo_entrada_categoria` = `subida` e a caminhada continua. União, Tesouro
Nacional, Fazenda Nacional, `natureza_juridica` 1xxx e `ente_federativo`
preenchido são `origem_tipo` = `estado` em `vinculos`, não linhas em `pessoas`.
Empresa pública (`2011`) e sociedade de economia mista (`2038`) continuam
caminhando. `CPF_CNPJ_Acionista` / `CPF_CNPJ_Acionista_Relacionado` iguais a
14 zeros (`00000000000000`) não são CNPJ — é o placeholder da CVM para
documento ausente (em geral PJ estrangeira). Não casam com o Banco do Brasil
(`00000000000191`). A origem é `estrangeiro`; `via` sem CNPJ resolvido fica
na emissora.

Em toda empresa visitada, unir o Formulário **e** o Quadro de Sócios: FRE não
substitui QSA. Sócio QSA entra mesmo sem percentual (`papel` = `socio`).

- **Companhia listada com Formulário de Referência:** usar
  `fre_cia_aberta_posicao_acionaria_YYYY.csv` dentro de
  `fre_cia_aberta_YYYY.zip` (dataset
  `https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre`; latin-1, `;`;
  tomar o maior `ID_Documento` por companhia). Flags citadas:
  `Acionista_Controlador` = `S`/`N` e `Participante_Acordo_Acionistas` =
  `S`/`N` — não existe CSV separado de acordo de acionistas. **Não** usar
  `fre_cia_historico_emissor` (é o antigo item 6.1, constituição do emissor,
  não posição acionária).
- **Demais empresas:** Quadro de Sócios e Administradores da Receita Federal
  via Base dos Dados, tabelas `basedosdados.br_me_cnpj.socios` e
  `basedosdados.br_me_cnpj.empresas`, partição `data` (variável
  `rf_partition_date`, hoje `2026-01-11`). Todo vínculo é `socio`;
  `tem_informacao_de_controle` = não. **Nunca** mintar administradores ou
  diretores como donos.

Os leitores dbt de staging
(`stg_cvm_fre_posicao_acionaria`, `stg_cvm_fre_capital_social`,
`stg_cvm_cia_aberta` e os demais `stg_*` em `transform/models/staging/`) são
somente higiene (tipos, `lpad`, nomes Base dos Dados). Não aplicam o filtro
da semente B. Os nomes originais das colunas-fonte (`CNPJ_CIA`,
`Acionista_Controlador`, …) continuam a ser a citação; o mapa para o nome
padronizado está em `transform/architecture/`. O JSON `graph/grafo-publico.json`
e o grafo de hops de 2189 nós da issue #174 **não** são fonte de verdade —
permanecem apenas como artefato v0.

#### Para baixo (um hop, travado)

Somente a partir de pessoa com `e_oligarca` = sim. Inverter por **CPF, nunca
por nome**, em **todas** as linhas do Formulário de Referência (todas as
companhias, não só a semente) e no Quadro de Sócios da Receita:

- No Formulário, o CPF do acionista está em `CPF_CNPJ_Acionista` (11 dígitos
  quando pessoa natural).
- Na Receita, `documento` vem mascarado; o casamento usa a máscara **derivada
  do CPF completo** armazenado em `pessoas` (nunca o nome sozinho); colisão de
  máscara sem CPF completo não é match.

Gravação: toda companhia em que a pessoa é `Acionista_Controlador` = `S` ou tem
`Percentual_Acao_Ordinaria_Circulacao` ≥ 10 (Formulário), e toda empresa em que
ela é sócia (Receita), entra em `empresas` com `motivo_entrada` = `hop`; e
**todos** os sócios citados dessas empresas entram em `vinculos` (e em
`pessoas`, quando ainda não existem). O sócio novo **não** é invertido: a
recursão para no primeiro hop, e empresa de hop não muda `e_oligarca` de
ninguém.

### Fontes de aterrissagem (resumo com URL exata)

| fonte | dataset/arquivo | colunas-chave | URL |
|---|---|---|---|
| Valor (semente A) | `data/controle-empresas-walk.csv` (repo) | nome/razão, rank | no repositório |
| CVM cadastro (B1) | `cad_cia_aberta.csv` | `CNPJ_CIA`, `SIT`, `CONTROLE_ACIONARIO` | `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv` |
| BCB Unicad (B2) | `EntidadesSupervisionadas(dataBase=@dataBase)` | `codigoCNPJ8`, `codigoCNPJ14`, `codigoTipoSituacaoPessoaJuridica`, `codigoTipoEntidadeSupervisionada` | `https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata/` |
| SUSEP cadastro (B3) | `DadosCadastrais` (dump completo, sem `$top`) | `entcgc`, `mercodigo`, `entnome` | `https://dados.susep.gov.br/olinda/servico/empresas/versao/v1/odata/DadosCadastrais` |
| FRE posição acionária | `fre_cia_aberta_posicao_acionaria_YYYY.csv` em `fre_cia_aberta_YYYY.zip` | `CNPJ_Companhia`, `CPF_CNPJ_Acionista`, `Acionista_Controlador`, `Percentual_Acao_Ordinaria_Circulacao`, `Participante_Acordo_Acionistas`, `ID_Documento` | `https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre` |
| Receita QSA | `basedosdados.br_me_cnpj.socios` / `empresas` | `cnpj_basico`, `tipo`, `nome`, `documento`, `qualificacao`, partição `data` | Base dos Dados (BigQuery) |
| B3 listadas | `GetInitialCompanies` (type=1, campo `cnpj`), `GetListedSupplementCompany` | `cnpj`, quantidades de ações | `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/` |
| B3 preços | `COTAHIST_A2026.ZIP` | `TPMERC`=010, `CODBDI`=02, `PREULT`, `CODNEG` | `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A2026.ZIP` |
| CVM FCA (ticker→CNPJ) | `fca_cia_aberta_valor_mobiliario_2026.csv` | `Codigo_Negociacao` | `https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca` |
| IF.data (piso banco) | `IfDataValores(...)`, `Relatorio`=`'2'` | `Conta`=`140220` (Ativo Total), `Saldo` | `https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/` |
| SUSEP receitas (piso seguradora) | `ReceitasSeguros(Ano=@Ano)` | `valor` (prêmios emitidos) | `https://dados.susep.gov.br/olinda/servico/receitasoperacionais/versao/v1/odata/` |

Nenhuma das barras Formulário de Referência / Unicad / SUSEP / COTAHIST existe
como tabela pronta na Base dos Dados — só o Quadro de Sócios e empresas
(`basedosdados.br_me_cnpj`) já usados. `basedosdados.br_b3_cotacoes.cotacoes` é
fita de negócios (trade tape), **não** o COTAHIST consolidado; não usar como
substituto.

### Costuras de teste (test seams)

Preferir **poucas** costuras. A costura ideal, e única obrigatória, é de ponta
a ponta no grão final:

> Fixtures dos três cadastros (uma fatia de `cad_cia_aberta.csv`, uma de
> `EntidadesSupervisionadas`, uma de `DadosCadastrais`) + uma fatia do
> `fre_cia_aberta_posicao_acionaria` + uma fatia do Quadro de Sócios emitem as
> três tabelas `empresas`, `pessoas`, `vinculos` com uma pessoa
> conhecida de `e_oligarca` = verdadeiro (um controlador `S` na fatia FRE) e
> uma pessoa conhecida de `e_oligarca` = falso (sócia citada sem controle e sem
> 10% de ordinárias).

Mecanismo: testes unitários nativos do dbt com fixtures SQL no alvo duckdb, o
mesmo seam que a CI existente (`.github/workflows/dbt-ci.yml`, `dbt parse` +
`dbt test --select test_type:unit`, sem credenciais GCP).

## Decisões de teste

1. **Ponta a ponta única** (acima): cadastros + FRE + QSA → três tabelas com
   `e_oligarca` conhecido. É o teste que trava a definição.
2. **Contratos de grão**: `empresas.cnpj` único; `pessoas.pessoa_id`
   único; `vinculos` é aresta de caminho (pessoa no veículo; sem `via`);
   zeros à esquerda preservados (o exemplo canônico JBS
   `02916265000160` já está nos testes dos leitores CVM mantidos).
3. **Regras negativas dentro do teste ponta a ponta**, não como seams novos:
   sócio da Receita nunca emite `papel` = `acionista_controlador`; homônimos
   de 2 tokens sem máscara comum não se fundem; empresa de hop não flipa `e_oligarca`; `tem_piso` =
   falso não remove empresa.
4. **Redação de CPF na costura pública existente**: os testes do site já
   varrem o HTML construído (`test/cpf-redaction-global.test.ts`); qualquer
   exportação futura das três tabelas para página pública passa por essa
   mesma costura. Nenhum CPF de 11 dígitos em HTML público, nunca.

Não criar um arquivo de teste unitário por modelo intermediário como fazia a
camada antiga (eram doze `unit_test_*.yml`); intermediários são cobertos pela
costura ponta a ponta.

## Fora de escopo

- **Fase 2**: influência sobre o Estado (doações TSE, cargos, contratos). As
  fontes TSE saíram do projeto dbt junto com a camada antiga.
- **Família** como unidade (a unidade é a pessoa natural).
- **Livro de acionistas de S.A. fechada**: sem fonte pública; a caminhada para
  em `Outros`/tesouraria/fechada sem livro, e o buraco fica documentado.
- **Reescrita do grafo v0**: artefato congelado em `graph/grafo-publico.json`.
  A issue #22 (texto do congelamento) não é reescrita.
- **Forbes como definição**: no máximo lista de conferência editorial; nunca
  entra no critério `e_oligarca`.
- **Inventar fortuna**: sem percentual citado não há valor; caminhos
  incompletos ficam rotulados `fortuna_incompleta`.
- **CPF público**: CPF completo é coluna de armazém para matching; nunca em
  HTML, JSON público, markdown espelho ou JSON-LD.
