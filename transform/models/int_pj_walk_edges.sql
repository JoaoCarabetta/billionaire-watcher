{{
    config(
        cluster_by=['from_id'] if target.type == 'bigquery' else none
    )
}}

select
    company_key as from_id,
    owner_company_id as to_id,
    fonte,
    percentual_total
from {{ ref('int_ownership_edges') }}
where owner_kind = 'empresa' and owner_company_id is not null
