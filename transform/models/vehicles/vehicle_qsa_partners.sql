-- Partners of the nine graph control vehicles (issue #88).
-- Source query: basedosdados.br_me_cnpj.socios at var('rf_partition_date').
-- Grain: one Receita QSA row per vehicle and partner. A vehicle with no rows
-- emits one explicit row with partner_count=0 and the reproducible source_query.
-- Receita has no ownership percentage column, so percent is always null.

with vehicle_roots as (
    select distinct
        lpad(cast(cnpj_basico as string), 8, '0') as cnpj_basico
    from {{ ref('vehicle_cnpj_basicos') }}
),

roots_with_query as (
    select
        cnpj_basico,
        concat(
            'SELECT tipo, nome, documento, qualificacao, data_entrada_sociedade ',
            'FROM basedosdados.br_me_cnpj.socios WHERE data = DATE ',
            chr(39),
            cast(date '{{ var("rf_partition_date") }}' as string),
            chr(39),
            ' AND LPAD(CAST(cnpj_basico AS STRING), 8, ',
            chr(39),
            '0',
            chr(39),
            ') = ',
            chr(39),
            cnpj_basico,
            chr(39)
        ) as source_query
    from vehicle_roots
),

filtered_socios as (
    select
        roots.cnpj_basico,
        cast(socios.tipo as string) as tipo,
        socios.nome,
        socios.documento,
        socios.qualificacao,
        socios.data_entrada_sociedade
    from {{ source('br_me_cnpj', 'socios') }} as socios
    inner join roots_with_query as roots
        on lpad(cast(socios.cnpj_basico as string), 8, '0') = roots.cnpj_basico
    where socios.data = date '{{ var("rf_partition_date") }}'
),

partner_rows as (
    select
        socios.cnpj_basico,
        socios.tipo,
        socios.nome,
        socios.documento,
        socios.qualificacao,
        socios.data_entrada_sociedade,
        cast(null as double) as percent,
        count(*) over (partition by socios.cnpj_basico) as partner_count,
        roots.source_query
    from filtered_socios as socios
    inner join roots_with_query as roots
        on socios.cnpj_basico = roots.cnpj_basico
),

empty_rows as (
    select
        roots.cnpj_basico,
        cast(null as string) as tipo,
        cast(null as string) as nome,
        cast(null as string) as documento,
        cast(null as string) as qualificacao,
        cast(null as date) as data_entrada_sociedade,
        cast(null as double) as percent,
        0 as partner_count,
        roots.source_query
    from roots_with_query as roots
    where not exists (
        select 1
        from filtered_socios as socios
        where socios.cnpj_basico = roots.cnpj_basico
    )
)

select
    cnpj_basico,
    tipo,
    nome,
    documento,
    qualificacao,
    data_entrada_sociedade,
    percent,
    partner_count,
    source_query
from partner_rows

union all

select
    cnpj_basico,
    tipo,
    nome,
    documento,
    qualificacao,
    data_entrada_sociedade,
    percent,
    partner_count,
    source_query
from empty_rows
