with recursive
{{ ownership_edge_ctes() }},

walk_roots as (
    select root_empresa_id
    from {{ ref('int_walk_roots') }}
),

{{ ownership_walk_ctes('walk_roots') }},

{{ downward_hop_ctes('walked_ownership_edges') }},

upward_person_citations as (
    select
        case
            when edges.owner_cpf is not null
                then {{ person_id_from_cpf('edges.owner_cpf') }}
            else
                {{ provisional_person_id(
                    'edges.owner_name',
                    'edges.cited_empresa_id'
                ) }}
        end as pessoa_id,
        edges.owner_name as nome,
        edges.owner_cpf as cpf,
        edges.cited_empresa_id,
        edges.fonte,
        edges.acionista_controlador,
        edges.percentual_on,
        seeds.root_empresa_id is not null as cited_on_seed
    from walked_ownership_edges as edges
    left join walk_roots as seeds
        on edges.cited_empresa_id = seeds.root_empresa_id
    where edges.owner_kind = 'pessoa'
),

hop_person_citations as (
    select
        case
            when edges.owner_cpf is not null
                then {{ person_id_from_cpf('edges.owner_cpf') }}
            else
                {{ provisional_person_id(
                    'edges.owner_name',
                    'edges.cited_empresa_id'
                ) }}
        end as pessoa_id,
        edges.owner_name as nome,
        edges.owner_cpf as cpf,
        edges.cited_empresa_id,
        edges.fonte,
        edges.acionista_controlador,
        edges.percentual_on,
        false as cited_on_seed
    from downward_hop_person_edges as edges
),

person_citations as (
    select * from upward_person_citations
    union all
    select * from hop_person_citations
)

select
    pessoa_id,
    max(nome) as nome,
    max(cpf) as cpf,
    cast(null as string) as filiacao,
    cast(null as date) as data_nascimento,
    max(
        case
            when
                cited_on_seed
                and fonte = 'fre'
                and (
                    acionista_controlador
                    or percentual_on >= 10
                )
                then 1
            else 0
        end
    ) = 1 as e_oligarca,
    cast(null as numeric) as fortuna_valor,
    true as fortuna_incompleta
from person_citations
group by pessoa_id
