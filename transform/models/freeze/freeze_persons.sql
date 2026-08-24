-- freeze_persons.sql
-- Final freeze table: grupo × pessoa natural × papel
-- Union all freeze sources per issue #22 spec

with listed_controllers as (
    select * from {{ ref('int_freeze_listed_controllers') }}
),

soe_groups as (
    select * from {{ ref('int_freeze_soe') }}
),

unlisted_rf as (
    select * from {{ ref('int_freeze_unlisted_rf') }}
),

foreign_hq as (
    select * from {{ ref('int_freeze_foreign_hq') }}
),

all_freeze_rows as (
    select * from listed_controllers
    union all
    select * from soe_groups
    union all
    select * from unlisted_rf
    union all
    select * from foreign_hq
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
from all_freeze_rows
order by group_rank, person_name
