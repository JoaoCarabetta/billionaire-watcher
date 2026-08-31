# Profile: stg_b3_cotahist

Source: `b3.cotahist_2026`. Fixed-width COTAHIST_A2026 already filtered `TPMERC=010` and `CODBDI=02`. **Not** `basedosdados.br_b3_cotacoes.cotacoes`.

## Overview

- **Grain**: one official close per ticker per session
- **Primary key**: (`ticker`, `data_pregao`)

## Column analysis

`PREULT` is integer cents. Staging emits `preco_fechamento = PREULT / 100` in BRL. Floor later takes the latest `data_pregao` per ticker and requires `preco_fechamento >= 0`.

## Recommended seed filter (not applied)

Latest session per ticker when computing the bolsa floor.
