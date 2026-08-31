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
    select * from {{ source('rf', 'socios') }}
),

cleaned as (
    select
        {{ to_date('data') }} as data,
        {{ to_int64('ano') }} as ano,
        {{ to_int64('mes') }} as mes,
        {{ cnpj8('cnpj_basico') }} as cnpj_basico,
        {{ clean_string('tipo') }} as tipo,
        {{ clean_string('nome') }} as nome,
        {{ documento_identificador('documento') }} as documento,
        case
            when length({{ digits_only('qualificacao') }}) > 0
                then lpad({{ digits_only('qualificacao') }}, 2, '0')
            else cast(null as string)
        end as qualificacao,
        {{ to_date('data_entrada_sociedade') }} as data_entrada_sociedade,
        {{ clean_string('id_pais') }} as id_pais,
        {{ documento_identificador('cpf_representante_legal') }} as cpf_representante_legal,
        {{ clean_string('nome_representante_legal') }} as nome_representante_legal,
        case
            when length({{ digits_only('qualificacao_representante_legal') }}) > 0
                then lpad({{ digits_only('qualificacao_representante_legal') }}, 2, '0')
            else cast(null as string)
        end as qualificacao_representante_legal,
        {{ clean_string('faixa_etaria') }} as faixa_etaria
    from source
)

select * from cleaned
