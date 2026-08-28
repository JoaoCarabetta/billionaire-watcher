{{
    config(
        cluster_by=['from_id'] if target.type == 'bigquery' else none
    )
}}

with walk_keys as (
    select empresa_id as join_key
    from {{ ref('int_company_walk') }}

    union distinct

    select empresa_cnpj8
    from {{ ref('int_company_walk') }}
    where empresa_cnpj8 is not null
)

select distinct
    pj.from_id,
    pj.to_id,
    pj.fonte,
    pj.percentual_total
from {{ ref('int_pj_walk_edges') }} as pj
inner join walk_keys as keys
    on pj.from_id = keys.join_key
