with recursive seed_a_normalized as (
    select
        trim(cast(nome as string)) as razao_social,
        {{ digits_only('identificador') }} as identificador_digits,
        {{ normalize_company_name('nome') }} as nome_normalizado
    from {{ source('fase1_landing', 'controle_empresas_walk') }}
),

seed_a as (
    select
        case
            when length(identificador_digits) = 14
                then lpad(identificador_digits, 14, '0')
        end as cnpj,
        case
            when length(identificador_digits) = 14
                then lpad(identificador_digits, 14, '0')
            else concat('nome:', nome_normalizado)
        end as empresa_id,
        razao_social,
        true as em_semente_a,
        cast(null as string) as fonte_semente_b,
        nome_normalizado in ('FOLHA', 'GLOBO', 'HAVAN', 'RECORD')
            or (
                nome_normalizado = 'NATURAECO'
                and length(identificador_digits) != 14
            ) as nao_caminha
    from seed_a_normalized
    where
        length(identificador_digits) = 14
        or nome_normalizado in ('FOLHA', 'GLOBO', 'HAVAN', 'RECORD', 'NATURAECO')
),

seed_b_cvm as (
    select
        CNPJ_CIA as cnpj,
        CNPJ_CIA as empresa_id,
        DENOM_SOCIAL as razao_social,
        false as em_semente_a,
        'cvm' as fonte_semente_b,
        false as nao_caminha
    from {{ ref('stg_cvm_cad_cia_aberta') }}
    where
        upper(trim(SIT)) = 'ATIVO'
        and length(CNPJ_CIA) = 14
),

seed_b_bcb_normalized as (
    select
        {{ digits_only('codigoCNPJ14') }} as cnpj,
        cast(nomeEntidadeInteresse as string) as razao_social,
        cast(codigoTipoSituacaoPessoaJuridica as integer) as codigo_situacao,
        cast(codigoTipoEntidadeSupervisionada as integer) as codigo_tipo
    from {{ source('fase1_landing', 'bcb_entidades_supervisionadas') }}
    where length({{ digits_only('codigoCNPJ14') }}) = 14
),

seed_b_bcb as (
    select
        cnpj,
        cnpj as empresa_id,
        razao_social,
        false as em_semente_a,
        'bcb' as fonte_semente_b,
        false as nao_caminha
    from seed_b_bcb_normalized
    where
        codigo_situacao = 3
        and codigo_tipo in (2, 4, 5, 6, 7, 8, 13, 28, 39)
        and codigo_tipo not in (3, 9, 11)
        -- "0001" is the four-digit establishment component of a full CNPJ;
        -- the final two digits are its check digits.
        and substr(cnpj, 9, 4) = '0001'
),

seed_b_susep_normalized as (
    select
        {{ digits_only('entcgc') }} as cnpj,
        cast(entnome as string) as razao_social,
        cast(mercodigo as integer) as mercodigo
    from {{ source('fase1_landing', 'susep_dados_cadastrais') }}
    where length({{ digits_only('entcgc') }}) = 14
),

seed_b_susep as (
    select
        cnpj,
        cnpj as empresa_id,
        razao_social,
        false as em_semente_a,
        'susep' as fonte_semente_b,
        false as nao_caminha
    from seed_b_susep_normalized
    where mercodigo in (1, 2, 3, 4, 6)
),

all_seed_rows as (
    select * from seed_a
    union all
    select * from seed_b_cvm
    union all
    select * from seed_b_bcb
    union all
    select * from seed_b_susep
),

company_rollup as (
    select
        empresa_id,
        max(cnpj) as cnpj,
        coalesce(
            max(case when em_semente_a then razao_social end),
            max(case when fonte_semente_b = 'cvm' then razao_social end),
            max(case when fonte_semente_b = 'bcb' then razao_social end),
            max(case when fonte_semente_b = 'susep' then razao_social end)
        ) as razao_social,
        max(case when em_semente_a then 1 else 0 end) = 1 as em_semente_a,
        max(case when nao_caminha then 1 else 0 end) = 1 as nao_caminha
    from all_seed_rows
    group by empresa_id
),

seed_b_sources as (
    select
        empresa_id,
        array_agg(distinct fonte_semente_b order by fonte_semente_b) as fontes_semente_b
    from all_seed_rows
    where fonte_semente_b is not null
    group by empresa_id
),

{{ ownership_edge_ctes() }},

seed_companies as (
    select
        companies.empresa_id,
        companies.cnpj,
        companies.razao_social,
        companies.em_semente_a,
        coalesce(sources.fontes_semente_b, {{ empty_string_array() }}) as fontes_semente_b,
        'semente' as motivo_entrada,
        companies.nao_caminha,
        cast(null as numeric) as valor_do_piso,
        cast(null as string) as fonte_do_piso,
        false as tem_piso
    from company_rollup as companies
    left join seed_b_sources as sources using (empresa_id)
),

walk_roots as (
    select empresa_id as root_empresa_id
    from seed_companies
    where not nao_caminha
),

{{ ownership_walk_ctes('walk_roots') }},

{{ downward_hop_ctes('walked_ownership_edges') }},

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
    from walked_ownership_edges as edges
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
    from downward_hop_companies as hop
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
