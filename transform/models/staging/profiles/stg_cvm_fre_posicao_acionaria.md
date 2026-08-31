# Profile: stg_cvm_fre_posicao_acionaria

Source: `cvm.fre_posicao_acionaria_2026`. Live header confirmed 2026-08-31 (29 columns). Full official file, not a subset.

## Overview

- **Grain**: one (company, document, shareholder)
- **Primary key**: (`id_cnpj`, `data_referencia`, `id_documento`, `id_acionista`)

## Column analysis

`CPF_CNPJ_Acionista` may be masked. Percents are 0–100 (`proporcao_*`). Flags `Acionista_Controlador` and `Participante_Acordo_Acionistas` are `S`/`N`. Official spelling `CPF_CNPJ_Representante_legal` uses a lowercase L.

Walk later takes `max(id_documento)` per company. Stop names `Outros` and tesouraria stay in staging.

## Data quality issues

- Multiple document versions per company. Do not unique on company + shareholder alone.
- Related-shareholder columns are often null.

## Relationships

- `id_cnpj` → `stg_cvm_cia_aberta.id_cnpj` (orphans expected: cancelled issuers still file). Test as warn.

## Recommended seed filter (not applied)

None. Controller / 10% ON cuts belong in the oligarch definition, not staging.
