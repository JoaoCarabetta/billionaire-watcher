# billionaire-watcher

Arquivo cívico de poder econômico no Brasil. O armazém (dbt / BigQuery) marca
quem é `e_oligarca`. O sítio é HTML/CSS/JS estático em `site/`: uma tabela,
fichas com percursos citados, e um grafo que só expande vizinhos.

## Sítio

```sh
npm test
# depois do export:
python3 -m http.server 4173 --directory site
```

Cloudflare Pages: **sem build**, diretório de saída `site/` (ajuste no painel;
não dá para gravar isso só no repositório).

`site/dados/oligarcas.json` vai no git (a tabela abre sem BigQuery). Fichas e
grafo precisam dos shards gerados abaixo.

### Exportar o armazém

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/da-service-account.json
python3 scripts/export_site_data.py --out site/dados
```

O script **não** lê `cpf`, `filiacao` nem `data_nascimento`. Qualquer sequência
de 11 dígitos nos JSON aborta a escrita.

## Armazém

Ver [transform/README.md](transform/README.md) e
[docs/spec-fase1-oligarcas.md](docs/spec-fase1-oligarcas.md).

```sh
cd transform && dbt test --select test_type:unit --target test
```
