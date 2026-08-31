{{ config(labels={'origin': 'b3', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('b3', 'listed_companies') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('cnpj') }} as id_cnpj,
        {{ clean_string('codeCVM') }} as id_cvm,
        {{ clean_string('issuingCompany') }} as codigo_emissor,
        {{ clean_string('companyName') }} as razao_social,
        {{ clean_string('tradingName') }} as nome_comercial,
        {{ clean_string('type') }} as tipo
    from source
)

select * from cleaned
