{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['id_cnpj'],
    labels={'origin': 'cvm', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'cvm', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('cvm', 'fre_capital_social_2026') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('CNPJ_Companhia') }} as id_cnpj,
        {{ to_date('Data_Referencia') }} as data_referencia,
        {{ to_int64('Versao') }} as versao,
        {{ clean_string('ID_Documento') }} as id_documento,
        {{ clean_string('Nome_Companhia') }} as nome_companhia,
        {{ clean_string('ID_Capital_Social') }} as id_capital_social,
        {{ clean_string('Tipo_Capital') }} as tipo_capital,
        {{ clean_string('Data_Autorizacao_Aprovacao') }} as data_autorizacao_aprovacao,
        {{ to_numeric('Valor_Capital') }} as valor_capital,
        {{ clean_string('Prazo_Integralizacao') }} as prazo_integralizacao,
        {{ to_int64('Quantidade_Acoes_Ordinarias') }} as quantidade_acao_ordinaria,
        {{ to_int64('Quantidade_Acoes_Preferenciais') }} as quantidade_acao_preferencial,
        {{ to_int64('Quantidade_Total_Acoes') }} as quantidade_total_acao
    from source
)

select * from cleaned
