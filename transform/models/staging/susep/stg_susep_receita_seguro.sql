{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['id_cnpj'],
    labels={'origin': 'susep', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'susep', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('susep', 'receitas_seguros_2026') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('cnpj') }} as id_cnpj,
        {{ clean_string('entnome') }} as nome,
        {{ clean_string('mesreferencia') }} as mes_referencia,
        {{ clean_string('grupo') }} as grupo,
        {{ clean_string('ramo') }} as ramo,
        {{ to_numeric('valor') }} as valor
    from source
)

select * from cleaned
