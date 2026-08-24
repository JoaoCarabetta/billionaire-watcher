-- stg_cvm_fre_posicao_acionaria_2026.sql
-- CVM FRE shareholder position 2026
-- Source: GCS raw/cvm/fre/2026/fre_cia_aberta_posicao_acionaria_2026.csv (latin-1, semicolon)

with source as (
    select * from {{ source('gcs_cvm', 'fre_posicao_acionaria_2026') }}
),

cleaned as (
    select
        lpad(regexp_replace(cast(CNPJ_Companhia as string), '[^0-9]', '', 'g'), 14, '0') as CNPJ_Companhia,
        cast(Data_Referencia as date) as Data_Referencia,
        cast(Versao as int64) as Versao,
        cast(ID_Documento as int64) as ID_Documento,
        cast(Nome_Companhia as string) as Nome_Companhia,
        cast(ID_Acionista as int64) as ID_Acionista,
        cast(Acionista as string) as Acionista,
        cast(Tipo_Pessoa_Acionista as string) as Tipo_Pessoa_Acionista,
        cast(CPF_CNPJ_Acionista as string) as CPF_CNPJ_Acionista,
        cast(ID_Acionista_Relacionado as int64) as ID_Acionista_Relacionado,
        cast(Acionista_Relacionado as string) as Acionista_Relacionado,
        cast(Tipo_Pessoa_Acionista_Relacionado as string) as Tipo_Pessoa_Acionista_Relacionado,
        cast(CPF_CNPJ_Acionista_Relacionado as string) as CPF_CNPJ_Acionista_Relacionado,
        cast(Quantidade_Acao_Ordinaria_Circulacao as int64) as Quantidade_Acao_Ordinaria_Circulacao,
        cast(Percentual_Acao_Ordinaria_Circulacao as double) as Percentual_Acao_Ordinaria_Circulacao,
        cast(Quantidade_Acao_Preferencial_Circulacao as int64) as Quantidade_Acao_Preferencial_Circulacao,
        cast(Percentual_Acao_Preferencial_Circulacao as double) as Percentual_Acao_Preferencial_Circulacao,
        cast(Quantidade_Total_Acoes_Circulacao as int64) as Quantidade_Total_Acoes_Circulacao,
        cast(Percentual_Total_Acoes_Circulacao as double) as Percentual_Total_Acoes_Circulacao,
        cast(Nacionalidade as string) as Nacionalidade,
        cast(Sigla_UF as string) as Sigla_UF,
        cast(Residente_Exterior as string) as Residente_Exterior,
        cast(Representante_Legal as string) as Representante_Legal,
        cast(Tipo_Pessoa_Representante_Legal as string) as Tipo_Pessoa_Representante_Legal,
        cast(CPF_CNPJ_Representante_legal as string) as CPF_CNPJ_Representante_legal,
        cast(Data_Composicao_Capital_Social as string) as Data_Composicao_Capital_Social,
        cast(Data_Ultima_Alteracao as date) as Data_Ultima_Alteracao,
        cast(Acionista_Controlador as string) as Acionista_Controlador,
        cast(Participante_Acordo_Acionistas as string) as Participante_Acordo_Acionistas
    from source
)

select * from cleaned
