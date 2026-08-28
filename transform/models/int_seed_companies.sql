with seed_a_normalized as (
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
)

select
    companies.empresa_id,
    companies.cnpj,
    companies.razao_social,
    companies.em_semente_a,
    coalesce(sources.fontes_semente_b, {{ empty_string_array() }}) as fontes_semente_b,
    companies.nao_caminha
from company_rollup as companies
left join seed_b_sources as sources using (empresa_id)
