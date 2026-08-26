-- graph_listed_quantities.sql
-- Formulário share quantity at seed × class grain for priced listed seeds.
-- Issue #129: Coder / public graph sidecar. Not the money 17.1 CSV.
-- Prefer graph_edges hop qty when present (Energisa IR 14 Aug 2026 table 6.1 stays).
-- Else company-level outstanding from warehouse FRE item 17.1 (latest ID_Documento).
-- Tipo_Capital: Integralizado if that row has qty, else Emitido. Do not sum tipos.
-- Autorizado is a ceiling; Subscrito is not used. classe_acao subclasses are unused.
-- Grain: one row per cnpj_basico × classe (ordinaria / preferencial), not per holder.
-- Skip a priced seed × class only when hop qty is null and 17.1 has no quantity.
-- Unit classes (ENGI11) are never emitted. Claro has no Bolsa class so it never joins.

{% if target.name in ['test', 'ci'] %}
    {% set listed_prices_relation = ref('listed_prices_fixture') %}
{% else %}
    {% set listed_prices_relation = ref('b3_listed_prices') %}
{% endif %}

with hop_quantities as (
    select
        to_id as cnpj_basico,
        qty_ordinarias,
        qty_preferenciais,
        min(source_doc) as source_doc,
        min(source_locator) as source_locator,
        min(source_retrieved_at) as source_retrieved_at
    from {{ ref('graph_edges') }}
    where qty_ordinarias is not null
       or qty_preferenciais is not null
    group by
        to_id,
        qty_ordinarias,
        qty_preferenciais
),

priced_classes as (
    select distinct
        cnpj_basico,
        ticker,
        classe
    from {{ listed_prices_relation }}
    where classe in ('ordinaria', 'preferencial')
),

hop_ordinarias as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        h.qty_ordinarias as quantidade,
        h.source_doc,
        h.source_locator,
        h.source_retrieved_at
    from hop_quantities h
    inner join priced_classes p
        on h.cnpj_basico = p.cnpj_basico
       and p.classe = 'ordinaria'
    where h.qty_ordinarias is not null
),

hop_preferenciais as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        h.qty_preferenciais as quantidade,
        h.source_doc,
        h.source_locator,
        h.source_retrieved_at
    from hop_quantities h
    inner join priced_classes p
        on h.cnpj_basico = p.cnpj_basico
       and p.classe = 'preferencial'
    where h.qty_preferenciais is not null
),

hop_class as (
    select * from hop_ordinarias
    union all
    select * from hop_preferenciais
),

fre_latest_doc as (
    select
        CNPJ_Companhia,
        max(ID_Documento) as ID_Documento
    from {{ ref('stg_cvm_fre_capital_social_2026') }}
    group by CNPJ_Companhia
),

fre_latest_rows as (
    select
        f.CNPJ_Companhia,
        f.Data_Referencia,
        f.Versao,
        f.ID_Documento,
        f.ID_Capital_Social,
        f.Tipo_Capital,
        f.Quantidade_Acoes_Ordinarias,
        f.Quantidade_Acoes_Preferenciais
    from {{ ref('stg_cvm_fre_capital_social_2026') }} f
    inner join fre_latest_doc d
        on f.CNPJ_Companhia = d.CNPJ_Companhia
       and f.ID_Documento = d.ID_Documento
),

fre_ranked as (
    select
        CNPJ_Companhia,
        Data_Referencia,
        Versao,
        ID_Documento,
        ID_Capital_Social,
        Tipo_Capital,
        Quantidade_Acoes_Ordinarias,
        Quantidade_Acoes_Preferenciais,
        case Tipo_Capital
            when 'Capital Integralizado' then 1
            when 'Capital Emitido' then 2
        end as tipo_rank
    from fre_latest_rows
    where Tipo_Capital in ('Capital Integralizado', 'Capital Emitido')
      and (
            (Quantidade_Acoes_Ordinarias is not null and Quantidade_Acoes_Ordinarias <> 0)
         or (Quantidade_Acoes_Preferenciais is not null and Quantidade_Acoes_Preferenciais <> 0)
      )
),

fre_picked as (
    select
        CNPJ_Companhia,
        Data_Referencia,
        Versao,
        ID_Documento,
        ID_Capital_Social,
        Tipo_Capital,
        Quantidade_Acoes_Ordinarias,
        Quantidade_Acoes_Preferenciais,
        row_number() over (
            partition by CNPJ_Companhia
            order by tipo_rank, ID_Capital_Social desc
        ) as rn
    from fre_ranked
),

fre_company as (
    select
        substr(CNPJ_Companhia, 1, 8) as cnpj_basico,
        Quantidade_Acoes_Ordinarias,
        Quantidade_Acoes_Preferenciais,
        concat('CVM FRE item 17.1 ', Tipo_Capital) as source_doc,
        concat(
            'ID_Documento ', cast(ID_Documento as string),
            '; Data_Referencia ', cast(Data_Referencia as string),
            '; Versao ', cast(Versao as string)
        ) as source_locator,
        Data_Referencia as source_retrieved_at
    from fre_picked
    where rn = 1
),

fre_ordinarias as (
    select
        f.cnpj_basico,
        p.ticker,
        p.classe,
        f.Quantidade_Acoes_Ordinarias as quantidade,
        f.source_doc,
        f.source_locator,
        f.source_retrieved_at
    from fre_company f
    inner join priced_classes p
        on f.cnpj_basico = p.cnpj_basico
       and p.classe = 'ordinaria'
    where f.Quantidade_Acoes_Ordinarias is not null
      and f.Quantidade_Acoes_Ordinarias <> 0
),

fre_preferenciais as (
    select
        f.cnpj_basico,
        p.ticker,
        p.classe,
        f.Quantidade_Acoes_Preferenciais as quantidade,
        f.source_doc,
        f.source_locator,
        f.source_retrieved_at
    from fre_company f
    inner join priced_classes p
        on f.cnpj_basico = p.cnpj_basico
       and p.classe = 'preferencial'
    where f.Quantidade_Acoes_Preferenciais is not null
      and f.Quantidade_Acoes_Preferenciais <> 0
),

fre_class as (
    select * from fre_ordinarias
    union all
    select * from fre_preferenciais
),

combined as (
    select
        p.cnpj_basico,
        p.ticker,
        p.classe,
        coalesce(h.quantidade, f.quantidade) as quantidade,
        case
            when h.quantidade is not null then h.source_doc
            else f.source_doc
        end as source_doc,
        case
            when h.quantidade is not null then h.source_locator
            else f.source_locator
        end as source_locator,
        case
            when h.quantidade is not null then h.source_retrieved_at
            else f.source_retrieved_at
        end as source_retrieved_at
    from priced_classes p
    left join hop_class h
        on p.cnpj_basico = h.cnpj_basico
       and p.classe = h.classe
    left join fre_class f
        on p.cnpj_basico = f.cnpj_basico
       and p.classe = f.classe
)

select
    cnpj_basico,
    ticker,
    classe,
    quantidade,
    source_doc,
    source_locator,
    source_retrieved_at
from combined
where quantidade is not null
