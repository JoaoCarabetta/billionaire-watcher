-- stg_cvm_fre_capital_social_2026.sql
-- CVM FRE item 17.1 capital social 2026
-- Source: GCS raw/cvm/fre/2026/fre_cia_aberta_capital_social_2026.csv (latin-1, semicolon)
-- CNPJ_Companhia is 14-digit STRING (strip punctuation, lpad 14). Never invent /0001.

with source as (
    select * from {{ source('gcs_cvm', 'fre_capital_social_2026') }}
),

cleaned as (
    select
        {% if target.type == 'duckdb' %}
        lpad(regexp_replace(cast(CNPJ_Companhia as string), '[^0-9]', '', 'g'), 14, '0') as CNPJ_Companhia,
        {% else %}
        lpad(regexp_replace(cast(CNPJ_Companhia as string), '[^0-9]', ''), 14, '0') as CNPJ_Companhia,
        {% endif %}
        cast(Data_Referencia as date) as Data_Referencia,
        cast(Versao as int64) as Versao,
        cast(ID_Documento as int64) as ID_Documento,
        cast(Nome_Companhia as string) as Nome_Companhia,
        cast(ID_Capital_Social as int64) as ID_Capital_Social,
        cast(Tipo_Capital as string) as Tipo_Capital,
        cast(Data_Autorizacao_Aprovacao as string) as Data_Autorizacao_Aprovacao,
        {% if target.type == 'duckdb' %}
        cast(Valor_Capital as double) as Valor_Capital,
        {% else %}
        cast(Valor_Capital as float64) as Valor_Capital,
        {% endif %}
        cast(Prazo_Integralizacao as string) as Prazo_Integralizacao,
        cast(Quantidade_Acoes_Ordinarias as int64) as Quantidade_Acoes_Ordinarias,
        cast(Quantidade_Acoes_Preferenciais as int64) as Quantidade_Acoes_Preferenciais,
        cast(Quantidade_Total_Acoes as int64) as Quantidade_Total_Acoes
    from source
)

select * from cleaned
