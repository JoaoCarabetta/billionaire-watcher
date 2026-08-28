{{
    config(
        cluster_by=['empresa_id'] if target.type == 'bigquery' else none
    )
}}

with recursive
ownership_edges as (
    select * from {{ ref('int_ownership_edges') }}
),

{{ ownership_reachability_cte(ref('int_walk_roots')) }}

select
    root_empresa_id,
    current_empresa_id as empresa_id,
    max(current_cnpj8) as empresa_cnpj8,
    min(depth) as depth
from company_walk
group by root_empresa_id, current_empresa_id
