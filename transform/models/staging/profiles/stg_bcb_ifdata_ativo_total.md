# Profile: stg_bcb_ifdata_ativo_total

Source: `bcb.ifdata_ativo_total_prudencial`. Downloader already keeps Relatorio 2, Conta 140220, TipoInstituicao=1.

## Overview

- **Grain**: one Saldo per prudential reporter for that conta/quarter
- **Primary key**: (`tipo_instituicao`, `id_instituicao`, `ano_mes`, `conta`)

## Column analysis

`Saldo` is Ativo Total in BRL. Do not mix tipo 2 (financeiro) or 3 (individual). Staging does not re-filter; it types what was landed.

## Recommended seed filter (not applied)

Repeat the landed predicates in the floor model; never union another `TipoInstituicao`.
