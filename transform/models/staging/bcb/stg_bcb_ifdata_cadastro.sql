{{ config(labels={'origin': 'bcb', 'layer': 'staging'}) }}

with source as (
    select * from {{ source('bcb', 'ifdata_cadastro') }}
),

typed as (
    select
        {{ to_date('Data') }} as data,
        {{ clean_string('CodInst') }} as id_instituicao,
        {{ clean_string('CodConglomeradoPrudencial') }} as id_conglomerado_prudencial,
        {{ cnpj8('CnpjInstituicaoLider') }} as cnpj_basico_lider,
        {{ clean_string('NomeInstituicao') }} as nome,
        {{ clean_string('Situacao') }} as situacao
    from source
),

cleaned as (
    select
        data,
        {% if target.type == 'duckdb' %}
        strftime(data, '%Y%m') as ano_mes,
        {% else %}
        format_date('%Y%m', data) as ano_mes,
        {% endif %}
        id_instituicao,
        id_conglomerado_prudencial,
        cnpj_basico_lider,
        nome,
        situacao
    from typed
)

select * from cleaned
