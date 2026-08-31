# Profile: stg_rf_estabelecimento

Source: `rf.estabelecimentos` — BD partition copy (32+ columns).

## Overview

- **Grain**: one establishment per 14-digit `cnpj` per snapshot
- **Primary key**: (`data`, `cnpj`)

## Column analysis

`id_municipio` is IBGE 7 digits (directory). `cnpj_ordem = 0001` is the usual HQ. Old walk did not filter `identificador_matriz_filial`.

## Recommended seed filter (not applied)

Hop HQ pick prefers ordem `0001`. Not applied here.
