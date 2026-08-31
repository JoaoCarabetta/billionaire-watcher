{% if target.type == 'bigquery' %}
{{ config(
    partition_by={'field': 'data', 'data_type': 'date'},
    cluster_by=['cnpj_basico'],
    labels={'origin': 'rf', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'rf', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('rf', 'empresas') }}
),

cleaned as (
    select
        {{ to_date('data') }} as data,
        {{ to_int64('ano') }} as ano,
        {{ to_int64('mes') }} as mes,
        {{ cnpj8('cnpj_basico') }} as cnpj_basico,
        {{ clean_string('razao_social') }} as razao_social,
        case
            when length({{ digits_only('natureza_juridica') }}) > 0
                then lpad({{ digits_only('natureza_juridica') }}, 4, '0')
            else cast(null as string)
        end as natureza_juridica,
        case
            when length({{ digits_only('qualificacao_responsavel') }}) > 0
                then lpad({{ digits_only('qualificacao_responsavel') }}, 2, '0')
            else cast(null as string)
        end as qualificacao_responsavel,
        {{ to_float64('capital_social') }} as capital_social,
        {{ clean_string('porte') }} as porte,
        {{ clean_string('ente_federativo') }} as ente_federativo
    from source
)

select * from cleaned
