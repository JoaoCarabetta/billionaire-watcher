{{ config(labels={'origin': 'susep', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('susep', 'dados_cadastrais') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('entcgc') }} as id_cnpj,
        {{ clean_string('entnome') }} as nome,
        {{ clean_string('mercodigo') }} as tipo_mercado
    from source
)

select * from cleaned
