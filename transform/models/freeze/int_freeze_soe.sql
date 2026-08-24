-- int_freeze_soe.sql
-- SOE groups: skip_soe with no PF controller
-- União is not a person; do not freeze CEO/minister/CA chair

with group_flags as (
    select * from {{ ref('stg_group_flags') }}
    where soe_flag = true
)

select
    rank_2024 as group_rank,
    empresa as group_name,
    cnpj_basico,
    'Valor 1000 FY2024' as ranking_source,
    null as receita_fy2024_brl, -- TODO: add when revenue data available
    listed_flag,
    soe_flag,
    controlador_tipo,
    null as person_name, -- SOE has no PF controller
    null as role, -- No role for SOE
    null as edge_label, -- No edge for SOE
    null as acordo_acionistas,
    soe_source as source_doc,
    null as fre_item,
    false as hole, -- Not a hole, intentionally no PF
    null as cpf_masked,
    'skip_soe' as freeze_status,
    'Federal SOE: União is Art. 116 controller, not a natural person' as notes
from group_flags
