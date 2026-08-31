# Profile: stg_bcb_entidade_supervisionada

Source: `bcb.entidades_supervisionadas`. Downloader subset of 6 columns. `dataBase` = 08-01-2026.

## Overview

- **Grain**: one Unicad entity per `codigoCNPJ14` at the data-base
- **Primary key**: `id_cnpj`

## Column analysis

`codigoCNPJ8` is the institution; `codigoCNPJ14` is the line (headquarters end in `0001`). Named check `SedesBancoComMultCE` expects 154 seats in types {2,4,5,6,8,11,28} before the seed-B exclusion of type 11.

## Recommended seed filter (not applied)

`tipo_situacao = '3'` and `tipo_entidade` in {2,4,5,6,7,8,13,28,39}, not in {3,9,11}, headquarters `0001`.
