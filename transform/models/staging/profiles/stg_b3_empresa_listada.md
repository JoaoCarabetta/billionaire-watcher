# Profile: stg_b3_empresa_listada

Source: `b3.listed_companies`. GetInitialCompanies type=1 only; CNPJ zfilled 14 in the downloader.

## Overview

- **Grain**: one listed issuer per 14-digit CNPJ
- **Primary key**: `id_cnpj`

## Relationships

- `codigo_emissor` → `stg_b3_empresa_listada_complemento.codigo_emissor`
- `id_cnpj` → CVM cadastro (coverage of cadastro ATIVO ∩ traded ticker ≈ 336 in the spec)

## Recommended seed filter (not applied)

None. type=1 is already applied at land time.
