-- freeze_persons.sql
-- Final freeze table: grupo × pessoa natural × papel
-- Union all freeze sources per issue #22 spec

with listed_controllers as (
    select
        group_rank,
        group_name,
        cast(cnpj_basico as string) as cnpj_basico,
        ranking_source,
        cast(receita_fy2024_brl as double) as receita_fy2024_brl,
        listed_flag,
        soe_flag,
        controlador_tipo,
        cast(person_name as string) as person_name,
        cast(role as string) as role,
        cast(edge_label as string) as edge_label,
        cast(acordo_acionistas as string) as acordo_acionistas,
        source_doc,
        cast(fre_item as string) as fre_item,
        hole,
        cast(cpf_masked as string) as cpf_masked,
        freeze_status,
        notes
    from {{ ref('int_freeze_listed_controllers') }}
),

soe_groups as (
    select
        group_rank,
        group_name,
        cast(cnpj_basico as string) as cnpj_basico,
        ranking_source,
        cast(receita_fy2024_brl as double) as receita_fy2024_brl,
        listed_flag,
        soe_flag,
        controlador_tipo,
        cast(person_name as string) as person_name,
        cast(role as string) as role,
        cast(edge_label as string) as edge_label,
        cast(acordo_acionistas as string) as acordo_acionistas,
        source_doc,
        cast(fre_item as string) as fre_item,
        hole,
        cast(cpf_masked as string) as cpf_masked,
        freeze_status,
        notes
    from {{ ref('int_freeze_soe') }}
),

unlisted_rf as (
    select
        group_rank,
        group_name,
        cast(cnpj_basico as string) as cnpj_basico,
        ranking_source,
        cast(receita_fy2024_brl as double) as receita_fy2024_brl,
        listed_flag,
        soe_flag,
        controlador_tipo,
        cast(person_name as string) as person_name,
        cast(role as string) as role,
        cast(edge_label as string) as edge_label,
        cast(acordo_acionistas as string) as acordo_acionistas,
        source_doc,
        cast(fre_item as string) as fre_item,
        hole,
        cast(cpf_masked as string) as cpf_masked,
        freeze_status,
        notes
    from {{ ref('int_freeze_unlisted_rf') }}
),

foreign_hq as (
    select
        group_rank,
        group_name,
        cast(cnpj_basico as string) as cnpj_basico,
        ranking_source,
        cast(receita_fy2024_brl as double) as receita_fy2024_brl,
        listed_flag,
        soe_flag,
        controlador_tipo,
        cast(person_name as string) as person_name,
        cast(role as string) as role,
        cast(edge_label as string) as edge_label,
        cast(acordo_acionistas as string) as acordo_acionistas,
        source_doc,
        cast(fre_item as string) as fre_item,
        hole,
        cast(cpf_masked as string) as cpf_masked,
        freeze_status,
        notes
    from {{ ref('int_freeze_foreign_hq') }}
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
    cast(receita_fy2024_brl as double) as receita_fy2024_brl,
    listed_flag,
    soe_flag,
    controlador_tipo,
    cast(person_name as string) as person_name,
    cast(role as string) as role,
    cast(edge_label as string) as edge_label,
    cast(acordo_acionistas as string) as acordo_acionistas,
    source_doc,
    cast(fre_item as string) as fre_item,
    hole,
    cast(cpf_masked as string) as cpf_masked,
    freeze_status,
    notes
from all_freeze_rows
order by group_rank, person_name
