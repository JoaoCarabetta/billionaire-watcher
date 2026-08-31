{{ config(labels={'origin': 'b3', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('b3', 'listed_supplement') }}
),

cleaned as (
    select
        2026 as ano,
        {{ clean_string('code') }} as codigo_emissor,
        {{ clean_string('codeCVM') }} as id_cvm,
        {{ clean_string('tradingName') }} as nome_comercial,
        {{ parse_br_numeric('numberCommonShares') }} as quantidade_acao_ordinaria,
        {{ parse_br_numeric('numberPreferredShares') }} as quantidade_acao_preferencial,
        {{ parse_br_numeric('totalNumberShares') }} as quantidade_total_acao
    from source
)

select * from cleaned
