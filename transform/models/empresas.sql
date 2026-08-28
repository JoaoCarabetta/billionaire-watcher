with seed_companies as (
    select
        empresa_id,
        cnpj,
        razao_social,
        em_semente_a,
        fontes_semente_b,
        'semente' as motivo_entrada,
        nao_caminha,
        cast(null as numeric) as valor_do_piso,
        cast(null as string) as fonte_do_piso,
        false as tem_piso
    from {{ ref('int_seed_companies') }}
),

subida_ranked as (
    select
        edges.owner_company_id as empresa_id,
        case
            when edges.owner_company_id not like 'nome:%'
                then edges.owner_company_id
        end as cnpj,
        edges.owner_name as razao_social,
        row_number() over (
            partition by edges.owner_company_id
            order by edges.fonte, edges.owner_name
        ) as company_row
    from {{ ref('int_walked_ownership_edges') }} as edges
    left join seed_companies as seeds
        on edges.owner_company_id = seeds.empresa_id
    where
        edges.owner_kind = 'empresa'
        and edges.owner_company_id is not null
        and seeds.empresa_id is null
),

subida_companies as (
    select
        empresa_id,
        cnpj,
        razao_social,
        false as em_semente_a,
        {{ empty_string_array() }} as fontes_semente_b,
        'subida' as motivo_entrada,
        false as nao_caminha,
        cast(null as numeric) as valor_do_piso,
        cast(null as string) as fonte_do_piso,
        false as tem_piso
    from subida_ranked
    where company_row = 1
),

hop_companies as (
    select
        hop.empresa_id,
        hop.cnpj,
        hop.razao_social,
        false as em_semente_a,
        {{ empty_string_array() }} as fontes_semente_b,
        'hop' as motivo_entrada,
        false as nao_caminha,
        cast(null as numeric) as valor_do_piso,
        cast(null as string) as fonte_do_piso,
        false as tem_piso
    from (
        select distinct empresa_id, cnpj, razao_social
        from {{ ref('int_downward_hop') }}
    ) as hop
    left join seed_companies as seeds using (empresa_id)
    left join subida_companies as subida using (empresa_id)
    where
        seeds.empresa_id is null
        and subida.empresa_id is null
),

all_companies as (
    select * from seed_companies
    union all
    select * from subida_companies
    union all
    select * from hop_companies
)

select
    companies.empresa_id,
    companies.cnpj,
    companies.razao_social,
    companies.em_semente_a,
    companies.fontes_semente_b,
    companies.motivo_entrada,
    companies.nao_caminha,
    floors.valor_do_piso,
    floors.fonte_do_piso,
    coalesce(floors.tem_piso, false) as tem_piso
from all_companies as companies
left join {{ ref('int_empresas_piso') }} as floors using (empresa_id)
