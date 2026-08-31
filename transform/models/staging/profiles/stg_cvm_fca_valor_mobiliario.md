# Profile: stg_cvm_fca_valor_mobiliario

Source: `cvm.fca_valor_mobiliario_2026`. Live header confirmed 2026-08-31 (18 columns).

## Overview

- **Grain**: one security line on an FCA filing
- **Primary key**: (`id_cnpj`, `id_documento`, `ticker`, `tipo_valor_mobiliario`) — ticker may be `NÃO HÁ` or empty

## Column analysis

`Codigo_Negociacao` joins COTAHIST `CODNEG`. `Mercado` includes Bolsa. `Data_Fim_Negociacao` empty means still listed.

## Relationships

- `ticker` → `stg_b3_cotahist.ticker` (orphans expected for unlisted / units / BDRs). Warn only.

## Recommended seed filter (not applied)

Floor later: `tipo_mercado = 'Bolsa'`, empty `data_fim_negociacao`, ticker not empty/`NÃO HÁ`, latest `id_documento` per (CNPJ, ticker).
