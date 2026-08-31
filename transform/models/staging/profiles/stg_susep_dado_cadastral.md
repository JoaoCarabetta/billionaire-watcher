# Profile: stg_susep_dado_cadastral

Source: `susep.dados_cadastrais`. Downloader writes `mercodigo`, `entnome`, `entcgc` (full dump, no `$top`). Spec snapshot: 362 rows in the reference apuração.

## Overview

- **Grain**: one supervised entity per `entcgc`
- **Primary key**: `id_cnpj`

## Recommended seed filter (not applied)

`tipo_mercado` in {1,2,3,4,6}.
