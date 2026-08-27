-- One market-cap floor per 14-digit CNPJ.
-- Quantities come from B3 GetListedSupplementCompany. Prices are the latest
-- official PREULT per ticker in COTAHIST_A2026 (TPMERC=010, CODBDI=02).
-- FCA Codigo_Negociacao maps each ticker to the issuer CNPJ.

with listed_companies as (
    select
        lpad({{ digits_only('cnpj') }}, 14, '0') as cnpj,
        upper(trim(cast(issuingCompany as string))) as issuing_company
    from {{ source('fase1_landing', 'b3_listed_companies') }}
    where
        cast(type as string) = '1'
        and length({{ digits_only('cnpj') }}) between 1 and 14
),

supplements as (
    select
        upper(trim(cast(code as string))) as issuing_company,
        cast(
            replace(replace(cast(numberCommonShares as string), '.', ''), ',', '.')
            as numeric
        ) as common_shares,
        cast(
            replace(replace(cast(numberPreferredShares as string), '.', ''), ',', '.')
            as numeric
        ) as preferred_shares
    from {{ source('fase1_landing', 'b3_listed_supplement') }}
),

fca_normalized as (
    select
        lpad({{ digits_only('CNPJ_Companhia') }}, 14, '0') as cnpj,
        upper(trim(cast(Codigo_Negociacao as string))) as ticker,
        case
            when cast(Valor_Mobiliario as string) = 'Ações Ordinárias'
                then 'ordinaria'
            when cast(Valor_Mobiliario as string) like 'Ações Preferenciais%'
                then 'preferencial'
        end as share_class,
        cast(Data_Referencia as string) as data_referencia,
        cast(ID_Documento as int64) as id_documento,
        row_number() over (
            partition by
                lpad({{ digits_only('CNPJ_Companhia') }}, 14, '0'),
                upper(trim(cast(Codigo_Negociacao as string)))
            order by
                cast(ID_Documento as int64) desc,
                cast(Data_Referencia as string) desc
        ) as row_number
    from {{ source('fase1_landing', 'cvm_fca_valor_mobiliario_2026') }}
    where
        cast(Mercado as string) = 'Bolsa'
        and coalesce(trim(cast(Data_Fim_Negociacao as string)), '') = ''
        and coalesce(trim(cast(Codigo_Negociacao as string)), '') not in ('', 'NÃO HÁ')
        and length({{ digits_only('CNPJ_Companhia') }}) between 1 and 14
),

fca_tickers as (
    select
        cnpj,
        ticker,
        share_class
    from fca_normalized
    where row_number = 1 and share_class is not null
),

cotahist_ranked as (
    select
        upper(trim(cast(CODNEG as string))) as ticker,
        cast(DATA_PREGAO as string) as data_pregao,
        cast(PREULT as numeric) / 100 as preco_fechamento,
        cast(NUMNEG as int64) as numero_negocios,
        row_number() over (
            partition by upper(trim(cast(CODNEG as string)))
            order by cast(DATA_PREGAO as string) desc
        ) as row_number
    from {{ source('fase1_landing', 'b3_cotahist_2026') }}
    where
        lpad(cast(TPMERC as string), 3, '0') = '010'
        and lpad(cast(CODBDI as string), 2, '0') = '02'
        and cast(PREULT as numeric) >= 0
),

latest_quotes as (
    select
        ticker,
        data_pregao,
        preco_fechamento,
        numero_negocios
    from cotahist_ranked
    where row_number = 1
),

class_quotes as (
    select
        companies.cnpj,
        fca.share_class,
        fca.ticker,
        quotes.data_pregao,
        quotes.preco_fechamento,
        quotes.numero_negocios,
        case
            when fca.share_class = 'ordinaria' then supplements.common_shares
            when fca.share_class = 'preferencial' then supplements.preferred_shares
        end as quantidade_acoes,
        row_number() over (
            partition by companies.cnpj, fca.share_class
            order by
                quotes.data_pregao desc,
                quotes.numero_negocios desc,
                fca.ticker
        ) as row_number
    from listed_companies as companies
    inner join supplements using (issuing_company)
    inner join fca_tickers as fca using (cnpj)
    inner join latest_quotes as quotes using (ticker)
),

picked_classes as (
    select
        cnpj,
        quantidade_acoes * preco_fechamento as valor_classe
    from class_quotes
    where row_number = 1 and quantidade_acoes is not null
)

select
    cnpj,
    cast(sum(valor_classe) as numeric) as valor_do_piso
from picked_classes
group by cnpj
