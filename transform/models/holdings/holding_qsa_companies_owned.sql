-- One-hop companies where one of the six issue #110 graph holdings is a PJ partner.
-- Source: basedosdados.br_me_cnpj.socios + empresas at var('rf_partition_date').
-- CRITICAL: owner matching uses the FIRST eight digits of the normalized 14-digit
-- partner CNPJ (tipo='1'). It never searches for the key as a substring inside
-- documento and never invents a branch suffix. A holding with no edges emits one
-- explicit row with owned_company_count=0 and the reproducible source_query.
-- Receita has no percentage, so percent is null. Owned-company identity is the
-- 8-digit owned_cnpj_basico, owned_name, and qualificacao. documento is the PJ
-- partner document as Base dos Dados emits it and stays warehouse-only.
-- size_warning flags the bank-book seed key (when it has rows) and any owner
-- whose owned_company_count meets holding_owned_size_warning_threshold.
-- This model does not write public HTML or /grafo.

with holding_roots as (
    select distinct
        lpad(cast(cnpj_basico as string), 8, '0') as owner_cnpj_basico,
        coalesce(bank_book, false) as bank_book
    from {{ ref('holding_invert_cnpj_basicos') }}
),

roots_with_query as (
    select
        owner_cnpj_basico,
        bank_book,
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
            ' AND LEFT(LPAD(REGEXP_REPLACE(CAST(s.documento AS STRING), r',
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
            '), 8) = ',
            chr(39),
            owner_cnpj_basico,
            chr(39)
        ) as source_query
    from holding_roots
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
        roots.bank_book,
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
        on left(socios.partner_cnpj, 8) = roots.owner_cnpj_basico
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
        {% if target.type == 'duckdb' %}
        cast(
            (
                count(*) over (partition by owner_cnpj_basico)
                >= {{ var('holding_owned_size_warning_threshold') }}
                or (bank_book and count(*) over (partition by owner_cnpj_basico) > 0)
            ) as boolean
        ) as size_warning,
        {% else %}
        cast(
            (
                count(*) over (partition by owner_cnpj_basico)
                >= {{ var('holding_owned_size_warning_threshold') }}
                or (bank_book and count(*) over (partition by owner_cnpj_basico) > 0)
            ) as bool
        ) as size_warning,
        {% endif %}
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
        {% if target.type == 'duckdb' %}
        cast(false as boolean) as size_warning,
        {% else %}
        cast(false as bool) as size_warning,
        {% endif %}
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
    size_warning,
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
    size_warning,
    source_query
from empty_rows
