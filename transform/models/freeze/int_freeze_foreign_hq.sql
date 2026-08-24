-- int_freeze_foreign_hq.sql
-- Foreign HQ groups: freeze parent PF only if publicly named
-- Brazilian CEO is not default controller
-- Otherwise: HOLE

with group_flags as (
    select * from {{ ref('stg_group_flags') }}
    where controlador_tipo = 'foreign'
      and soe_flag = false
)

select
    rank_2024 as group_rank,
    empresa as group_name,
    cnpj_basico,
    'Valor 1000 FY2024' as ranking_source,
    null as receita_fy2024_brl,
    listed_flag,
    soe_flag,
    controlador_tipo,
    null as person_name, -- No PF unless publicly named (future: FRE 6.1.h / 20-F / 13D)
    null as role,
    null as edge_label,
    null as acordo_acionistas,
    source_doc,
    null as fre_item,
    true as hole, -- Hole unless we have FRE 6.1.h or equivalent
    null as cpf_masked,
    'hole' as freeze_status,
    'Foreign HQ: parent PF only if publicly named (FRE 6.1.h / 20-F / 13D). Brazilian CEO is not default controller.' as notes
from group_flags
