-- One Ativo Total floor per leading institution CNPJ8.
-- Grain choice is locked to IF.data TipoInstituicao=1: prudential
-- conglomerates and independent institutions. Individual (3) and financial
-- conglomerate (2) rows are never mixed into this model.

with cadastro_normalized as (
    select distinct
        coalesce(
            nullif(trim(cast(CodConglomeradoPrudencial as string)), ''),
            trim(cast(CodInst as string))
        ) as cod_inst_prudencial,
        lpad({{ digits_only('CnpjInstituicaoLider') }}, 8, '0') as codigo_cnpj8
    from {{ source('fase1_landing', 'ifdata_cadastro') }}
    where
        upper(trim(cast(Situacao as string))) = 'A'
        and length({{ digits_only('CnpjInstituicaoLider') }}) between 1 and 8
),

ativo_total as (
    select
        trim(cast(CodInst as string)) as cod_inst_prudencial,
        cast(Saldo as numeric) as saldo
    from {{ source('fase1_landing', 'ifdata_ativo_total_prudencial') }}
    where
        cast(TipoInstituicao as integer) = 1
        and cast(NumeroRelatorio as string) = '2'
        and cast(Conta as string) = '140220'
        and Saldo is not null
),

mapped as (
    select distinct
        cadastro.codigo_cnpj8,
        valores.cod_inst_prudencial,
        valores.saldo
    from ativo_total as valores
    inner join cadastro_normalized as cadastro using (cod_inst_prudencial)
),

seed_bank_headquarters as (
    select distinct
        lpad({{ digits_only('codigoCNPJ14') }}, 14, '0') as cnpj,
        lpad({{ digits_only('codigoCNPJ8') }}, 8, '0') as codigo_cnpj8
    from {{ source('fase1_landing', 'bcb_entidades_supervisionadas') }}
    where
        length({{ digits_only('codigoCNPJ14') }}) between 1 and 14
        and length({{ digits_only('codigoCNPJ8') }}) between 1 and 8
        and cast(codigoTipoSituacaoPessoaJuridica as integer) = 3
        and cast(codigoTipoEntidadeSupervisionada as integer)
            in (2, 4, 5, 6, 7, 8, 13, 28, 39)
        and cast(codigoTipoEntidadeSupervisionada as integer)
            not in (3, 9, 11)
        and substr(lpad({{ digits_only('codigoCNPJ14') }}, 14, '0'), 9, 4) = '0001'
),

companies as (
    select
        headquarters.cnpj,
        mapped.saldo
    from mapped
    inner join seed_bank_headquarters as headquarters using (codigo_cnpj8)
)

select
    cnpj,
    cast(max(saldo) as numeric) as valor_do_piso
from companies
group by cnpj
