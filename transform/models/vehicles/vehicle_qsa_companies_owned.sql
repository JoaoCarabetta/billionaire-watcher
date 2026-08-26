-- One-hop companies where one of the nine graph vehicles is a PJ partner.
-- Sources: basedosdados.br_me_cnpj.socios + empresas at var('rf_partition_date').
-- CRITICAL: owner matching uses the FIRST eight digits of the normalized 14-digit
-- partner CNPJ. It never searches for the key as a substring inside documento.
-- A vehicle with no edges emits one explicit row with owned_company_count=0 and
-- the reproducible source_query. Receita has no percentage, so percent is null.

with vehicle_roots as (
    select distinct
        lpad(cast(cnpj_basico as string), 8, '0') as owner_cnpj_basico
    from {{ ref('vehicle_cnpj_basicos') }}
),

roots_with_query as (
    select
        owner_cnpj_basico,
        concat(
            'SELECT s.cnpj_basico, e.razao_social, s.qualificacao, s.documento ',
            'FROM basedosdados.br_me_cnpj.socios AS s ',
            'JOIN basedosdados.br_me_cnpj.empresas AS e ',
            'ON LPAD(CAST(e.cnpj_basico AS STRING), 8, ',
            chr(39),
            '0',
            chr(39),
            ') = LPAD(CAST(s.cnpj_basico AS STRING), 8, ',
            chr(39),
            '0',
            chr(39),
            ') AND e.data = s.data WHERE s.data = DATE ',
            chr(39),
            cast(date '{{ var("rf_partition_date") }}' as string),
            chr(39),
            ' AND CAST(s.tipo AS STRING) = ',
            chr(39),
            '1',
            chr(39),
            ' AND SUBSTR(LPAD(REGEXP_REPLACE(CAST(s.documento AS STRING), r',
            chr(39),
            '[^0-9]',
            chr(39),
            ', ',
            chr(39),
            chr(39),
            '), 14, ',
            chr(39),
            '0',
            chr(39),
            '), 1, 8) = ',
            chr(39),
            owner_cnpj_basico,
            chr(39)
        ) as source_query
    from vehicle_roots
),

normalized_pj_socios as (
    select
        lpad(cast(socios.cnpj_basico as string), 8, '0') as owned_cnpj_basico,
        socios.qualificacao,
        socios.documento,
        {% if target.type == 'duckdb' %}
        lpad(
            regexp_replace(cast(socios.documento as string), '[^0-9]', '', 'g'),
            14,
            '0'
        ) as partner_cnpj
        {% else %}
        lpad(
            regexp_replace(cast(socios.documento as string), r'[^0-9]', ''),
            14,
            '0'
        ) as partner_cnpj
        {% endif %}
    from {{ source('br_me_cnpj', 'socios') }} as socios
    where socios.data = date '{{ var("rf_partition_date") }}'
      and cast(socios.tipo as string) = '1'
),

owned_company_rows as (
    select
        roots.owner_cnpj_basico,
        socios.owned_cnpj_basico,
        empresas.razao_social as owned_name,
        socios.qualificacao,
        socios.documento,
        {% if target.type == 'duckdb' %}
        cast(null as double) as percent,
        {% else %}
        cast(null as float64) as percent,
        {% endif %}
        roots.source_query
    from normalized_pj_socios as socios
    inner join roots_with_query as roots
        on substr(socios.partner_cnpj, 1, 8) = roots.owner_cnpj_basico
    inner join {{ source('br_me_cnpj', 'empresas') }} as empresas
        on socios.owned_cnpj_basico = lpad(cast(empresas.cnpj_basico as string), 8, '0')
       and empresas.data = date '{{ var("rf_partition_date") }}'
),

counted_rows as (
    select
        owner_cnpj_basico,
        owned_cnpj_basico,
        owned_name,
        qualificacao,
        documento,
        percent,
        count(*) over (partition by owner_cnpj_basico) as owned_company_count,
        source_query
    from owned_company_rows
),

empty_rows as (
    select
        roots.owner_cnpj_basico,
        cast(null as string) as owned_cnpj_basico,
        cast(null as string) as owned_name,
        cast(null as string) as qualificacao,
        cast(null as string) as documento,
        {% if target.type == 'duckdb' %}
        cast(null as double) as percent,
        {% else %}
        cast(null as float64) as percent,
        {% endif %}
        0 as owned_company_count,
        roots.source_query
    from roots_with_query as roots
    where not exists (
        select 1
        from owned_company_rows as companies
        where companies.owner_cnpj_basico = roots.owner_cnpj_basico
    )
)

select
    owner_cnpj_basico,
    owned_cnpj_basico,
    owned_name,
    qualificacao,
    documento,
    percent,
    owned_company_count,
    source_query
from counted_rows

union all

select
    owner_cnpj_basico,
    owned_cnpj_basico,
    owned_name,
    qualificacao,
    documento,
    percent,
    owned_company_count,
    source_query
from empty_rows
