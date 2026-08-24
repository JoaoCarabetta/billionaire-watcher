-- freeze_persons_with_forbes.sql
-- Final freeze table: positional freeze UNION Forbes safety-net
-- Issue #26: Forbes candidates are ADDITIVE on top of freeze_persons

with positional_freeze as (
    select * from {{ ref('freeze_persons') }}
),

forbes_candidates as (
    select * from {{ ref('int_forbes_candidates') }}
),

all_freeze_with_forbes as (
    select * from positional_freeze
    union all
    select * from forbes_candidates
)

select
    group_rank,
    group_name,
    cnpj_basico,
    ranking_source,
    receita_fy2024_brl,
    listed_flag,
    soe_flag,
    controlador_tipo,
    person_name,
    role,
    edge_label,
    acordo_acionistas,
    source_doc,
    fre_item,
    hole,
    cpf_masked,
    freeze_status,
    notes
from all_freeze_with_forbes
order by
    case when group_rank is not null then group_rank else 999 end,
    person_name
