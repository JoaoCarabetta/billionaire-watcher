{{ config(labels={'origin': 'valor', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('valor', 'seguradoras_2025') }}
),

cleaned as (
    select
        2025 as ano,
        {{ to_int64('rank_2024') }} as posicao,
        {{ clean_string('empresa') }} as nome,
        {{ clean_string('razao_social') }} as razao_social,
        {{ clean_string('source_url') }} as url_fonte,
        {{ to_date('retrieved_at') }} as data_coleta
    from source
)

select * from cleaned
