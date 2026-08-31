# Profile: stg_cvm_fre_capital_social

Source: `cvm.fre_capital_social_2026`. Live header confirmed 2026-08-31 (13 columns).

## Overview

- **Grain**: one (company, document, capital view, capital id)
- **Primary key**: (`id_cnpj`, `id_documento`, `tipo_capital`, `id_capital_social`)

## Column analysis

`Tipo_Capital` ∈ Autorizado / Emitido / Subscrito / Integralizado. These are **views, not addends**. Prefer Integralizado, else Emitido, only when building floors later.

`Valor_Capital` is money (NUMERIC, BRL). Share counts are integers.

## Recommended seed filter (not applied)

None. Latest document + preferred `tipo_capital` is intermediate logic.
