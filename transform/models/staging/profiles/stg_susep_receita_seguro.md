# Profile: stg_susep_receita_seguro

Source: `susep.receitas_seguros_2026`. Olinda `ReceitasSeguros(Ano='2026')`.

## Overview

- **Grain**: one insurer × month × group × ramo
- **Primary key**: (`id_cnpj`, `mes_referencia`, `grupo`, `ramo`)

## Column analysis

`valor` is emitted premiums, not SES `premio_ganho`. Floor later sums `valor` per CNPJ.

## Recommended seed filter (not applied)

14-digit CNPJ and `valor is not null` when aggregating the insurer floor.
