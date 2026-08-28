{{
    config(
        cluster_by=['cited_empresa_id'] if target.type == 'bigquery' else none
    )
}}

with walk_keys as (
    select distinct
        walk.root_empresa_id,
        walk.empresa_id as cited_empresa_id,
        join_key
    from {{ ref('int_company_walk') }} as walk
    cross join {{ walk_join_key_unnest('walk.empresa_id', 'walk.empresa_cnpj8') }}
    where join_key is not null
)

select distinct
    walk_keys.root_empresa_id,
    walk_keys.cited_empresa_id,
    edges.fonte,
    edges.owner_kind,
    edges.owner_company_id,
    edges.owner_name,
    edges.owner_document,
    edges.owner_cpf,
    edges.papel,
    edges.acionista_controlador,
    edges.participante_acordo_acionistas,
    edges.percentual_on,
    edges.percentual_total,
    edges.qualificacao,
    edges.data_referencia,
    edges.fonte_documento
from walk_keys
inner join {{ ref('int_ownership_edges') }} as edges
    on edges.company_key = walk_keys.join_key
