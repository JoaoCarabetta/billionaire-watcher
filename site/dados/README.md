# dados/

`oligarcas.json` e `meta.json` vão no git e alimentam a tabela inicial.

Os shards `e/`, `adj/` e `busca/` saem de:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/da-service-account.json
python3 scripts/export_site_data.py --out site/dados
```

Sem eles, a lista funciona; fichas e o grafo pedem o export. O script
remove sequências de 11 dígitos de nomes e nunca lê `cpf`.
