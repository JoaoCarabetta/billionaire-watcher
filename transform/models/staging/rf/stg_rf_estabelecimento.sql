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
    select * from {{ source('rf', 'estabelecimentos') }}
),

cleaned as (
    select
        {{ to_date('data') }} as data,
        {{ to_int64('ano') }} as ano,
        {{ to_int64('mes') }} as mes,
        {{ cnpj14('cnpj') }} as cnpj,
        {{ cnpj8('cnpj_basico') }} as cnpj_basico,
        case
            when length({{ digits_only('cnpj_ordem') }}) > 0
                then lpad({{ digits_only('cnpj_ordem') }}, 4, '0')
            else cast(null as string)
        end as cnpj_ordem,
        case
            when length({{ digits_only('cnpj_dv') }}) > 0
                then lpad({{ digits_only('cnpj_dv') }}, 2, '0')
            else cast(null as string)
        end as cnpj_dv,
        {{ clean_string('identificador_matriz_filial') }} as identificador_matriz_filial,
        {{ clean_string('nome_fantasia') }} as nome_fantasia,
        case
            when length({{ digits_only('situacao_cadastral') }}) > 0
                then lpad({{ digits_only('situacao_cadastral') }}, 2, '0')
            else cast(null as string)
        end as situacao_cadastral,
        {{ to_date('data_situacao_cadastral') }} as data_situacao_cadastral,
        {{ clean_string('motivo_situacao_cadastral') }} as motivo_situacao_cadastral,
        {{ clean_string('nome_cidade_exterior') }} as nome_cidade_exterior,
        {{ clean_string('id_pais') }} as id_pais,
        {{ to_date('data_inicio_atividade') }} as data_inicio_atividade,
        {{ clean_string('cnae_fiscal_principal') }} as cnae_fiscal_principal,
        {{ clean_string('cnae_fiscal_secundaria') }} as cnae_fiscal_secundaria,
        {{ clean_string('sigla_uf') }} as sigla_uf,
        {{ clean_string('id_municipio') }} as id_municipio,
        {{ clean_string('id_municipio_rf') }} as id_municipio_rf,
        {{ clean_string('tipo_logradouro') }} as tipo_logradouro,
        {{ clean_string('logradouro') }} as logradouro,
        {{ clean_string('numero') }} as numero,
        {{ clean_string('complemento') }} as complemento,
        {{ clean_string('bairro') }} as bairro,
        {{ clean_string('cep') }} as cep,
        {{ clean_string('ddd_1') }} as ddd_1,
        {{ clean_string('telefone_1') }} as telefone_1,
        {{ clean_string('ddd_2') }} as ddd_2,
        {{ clean_string('telefone_2') }} as telefone_2,
        {{ clean_string('ddd_fax') }} as ddd_fax,
        {{ clean_string('fax') }} as fax,
        {{ clean_string('email') }} as email,
        {{ clean_string('situacao_especial') }} as situacao_especial,
        {{ to_date('data_situacao_especial') }} as data_situacao_especial
    from source
)

select * from cleaned
