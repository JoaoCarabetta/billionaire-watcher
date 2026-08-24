-- stg_group_flags.sql
-- Top-50 billionaire watcher group flags
-- Source: seed from data/valor1000-2025/top50-flags.csv

with source as (
    select
        rank_2024,
        empresa,
        razao_social,
        lpad(cast(cnpj_basico as string), 8, '0') as cnpj_basico,
        lpad(regexp_replace(cast(cnpj_full as string), r'[^\d]', ''), 14, '0') as cnpj_full,
        cast(listed_flag as bool) as listed_flag,
        listed_source,
        cast(soe_flag as bool) as soe_flag,
        soe_source,
        controlador_tipo,
        freeze_status_hint,
        notes,
        source_doc,
        cnpj_source,
        cast(retrieved_at as date) as retrieved_at
    from {{ ref('top50_flags_seed') }}
)

select * from source
