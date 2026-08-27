with recursive
{{ ownership_edge_ctes() }},

walk_roots as (
    select root_empresa_id
    from {{ ref('int_walk_roots') }}
),

{{ ownership_walk_ctes('walk_roots') }},

{{ downward_hop_ctes('walked_ownership_edges') }},

fortune_company_edges as (
    select
        company_key,
        fonte,
        owner_company_id,
        max(percentual_total) as percentual_total
    from ownership_edges
    where owner_kind = 'empresa' and owner_company_id is not null
    group by company_key, fonte, owner_company_id
),

fortune_company_paths as (
    select
        root_empresa_id,
        root_empresa_id as current_empresa_id,
        0 as depth,
        concat('|', root_empresa_id, '|') as visited_path,
        cast(1.0 as {{ dbt.type_float() }}) as cited_share
    from walk_roots

    union all

    select
        paths.root_empresa_id,
        edges.owner_company_id as current_empresa_id,
        paths.depth + 1 as depth,
        concat(paths.visited_path, edges.owner_company_id, '|') as visited_path,
        case
            when
                paths.cited_share is not null
                and edges.percentual_total is not null
                then paths.cited_share * edges.percentual_total / 100.0
        end as cited_share
    from fortune_company_paths as paths
    inner join fortune_company_edges as edges
        on (
            edges.fonte = 'fre'
            and edges.company_key = paths.current_empresa_id
        ) or (
            edges.fonte = 'qsa'
            and edges.company_key = left(paths.current_empresa_id, 8)
        )
    where
        strpos(
            paths.visited_path,
            concat('|', edges.owner_company_id, '|')
        ) = 0
        and paths.depth < 50
),

upward_fortune_paths_raw as (
    select
        case
            when edges.owner_cpf is not null
                then {{ person_id_from_cpf('edges.owner_cpf') }}
            else
                {{ provisional_person_id(
                    'edges.owner_name',
                    'paths.current_empresa_id'
                ) }}
        end as pessoa_id,
        paths.root_empresa_id,
        paths.visited_path,
        edges.fonte,
        floors.valor_do_piso,
        case
            when
                paths.cited_share is not null
                and edges.percentual_total is not null
                then paths.cited_share * edges.percentual_total / 100.0
        end as cited_share,
        paths.cited_share is not null
            and edges.percentual_total is not null
            and coalesce(floors.tem_piso, false) as path_is_valued
    from fortune_company_paths as paths
    inner join ownership_edges as edges
        on (
            edges.fonte = 'fre'
            and edges.company_key = paths.current_empresa_id
        ) or (
            edges.fonte = 'qsa'
            and edges.company_key = left(paths.current_empresa_id, 8)
        )
    left join {{ ref('int_empresas_piso') }} as floors
        on paths.root_empresa_id = floors.empresa_id
    where edges.owner_kind = 'pessoa'
),

upward_fortune_paths as (
    select distinct *
    from upward_fortune_paths_raw
),

hop_fortune_paths_raw as (
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
        edges.cited_empresa_id as root_empresa_id,
        concat('|', edges.cited_empresa_id, '|') as visited_path,
        edges.fonte,
        floors.valor_do_piso,
        edges.percentual_total / 100.0 as cited_share,
        edges.percentual_total is not null
            and coalesce(floors.tem_piso, false) as path_is_valued
    from downward_hop_person_edges as edges
    left join {{ ref('int_empresas_piso') }} as floors
        on edges.cited_empresa_id = floors.empresa_id
),

hop_fortune_paths as (
    select distinct *
    from hop_fortune_paths_raw
),

all_fortune_paths as (
    select * from upward_fortune_paths
    union all
    select * from hop_fortune_paths
),

fortune_by_person as (
    select
        pessoa_id,
        cast(
            sum(
                case
                    when path_is_valued
                        then valor_do_piso * cited_share
                end
            ) as numeric
        ) as fortuna_valor,
        max(case when not path_is_valued then 1 else 0 end) = 1
            as fortuna_incompleta
    from all_fortune_paths
    group by pessoa_id
),

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
),

people_rollup as (
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
        ) = 1 as e_oligarca
    from person_citations
    group by pessoa_id
)

select
    people.pessoa_id,
    people.nome,
    people.cpf,
    people.filiacao,
    people.data_nascimento,
    people.e_oligarca,
    fortunes.fortuna_valor,
    coalesce(fortunes.fortuna_incompleta, true) as fortuna_incompleta
from people_rollup as people
left join fortune_by_person as fortunes using (pessoa_id)
