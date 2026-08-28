{{
    config(
        cluster_by=['empresa_id'] if target.type == 'bigquery' else none
    )
}}

with
{{ iterative_company_walk(ref('int_walk_roots'), ref('int_pj_walk_edges')) }}

select
    root_empresa_id,
    empresa_id,
    max(empresa_cnpj8) as empresa_cnpj8,
    min(depth) as depth
from company_walk
group by root_empresa_id, empresa_id
