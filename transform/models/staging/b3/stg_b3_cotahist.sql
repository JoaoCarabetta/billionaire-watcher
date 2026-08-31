{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['ticker'],
    labels={'origin': 'b3', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'b3', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('b3', 'cotahist_2026') }}
),

cleaned as (
    select
        {{ to_date_yyyymmdd('DATA_PREGAO') }} as data_pregao,
        {{ clean_string('CODNEG') }} as ticker,
        {{ clean_string('CODBDI') }} as codigo_bdi,
        {{ clean_string('TPMERC') }} as tipo_mercado,
        {{ to_numeric('PREULT') }} / 100 as preco_fechamento,
        {{ to_int64('NUMNEG') }} as quantidade_negocio
    from source
)

select * from cleaned
