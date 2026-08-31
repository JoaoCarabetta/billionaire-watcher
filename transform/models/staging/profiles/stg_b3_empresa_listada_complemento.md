# Profile: stg_b3_empresa_listada_complemento

Source: `b3.listed_supplement`. Share quantities may arrive with Brazilian thousands (`.`) and decimal (`,`).

## Overview

- **Grain**: one supplement row per issuer `code`
- **Primary key**: `codigo_emissor`

## Data quality issues

- Parse `parse_br_numeric` so `1.234.567,89` and `1234567.89` both work.

## Recommended seed filter (not applied)

None.
