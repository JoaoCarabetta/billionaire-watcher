-- graph_listed_prices.sql
-- Dated listed price facts: ticker, class, price, quantity, product, date, source
-- Business-day run appends a new row (does not overwrite yesterday)
-- Quantity comes from the listed hop (IR/FRE table) in graph_edges
-- Product is not written if any hop to a person has null percent (handled by graph_person_holdings)
-- Unlisted companies: no price row

{% if target.name in ['test', 'ci'] %}
    {% set listed_prices_relation = ref('listed_prices_fixture') %}
{% else %}
    {% set listed_prices_relation = ref('b3_listed_prices') %}
{% endif %}

with listed_hops as (
    select
        to_id as cnpj_basico,
        qty_ordinarias,
        qty_preferenciais,
        source_doc as quantity_source_doc,
        source_locator as quantity_source_locator
    from {{ ref('graph_edges') }}
    where (qty_ordinarias is not null or qty_preferenciais is not null)
),

prices as (
    select
        cnpj_basico,
        ticker,
        classe,
        preco,
        cast(preco_date as date) as preco_date,
        source as price_source
    from {{ listed_prices_relation }}
),

-- Ordinary shares with prices
ordinarias_priced as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        p.preco,
        h.qty_ordinarias as quantidade,
        p.preco * h.qty_ordinarias as produto,
        p.preco_date,
        concat(p.price_source, ' + ', h.quantity_source_doc, ' ', h.quantity_source_locator) as source
    from listed_hops h
    inner join prices p 
        on h.cnpj_basico = p.cnpj_basico
        and p.classe = 'ordinaria'
    where h.qty_ordinarias is not null
),

-- Preferred shares with prices
preferenciais_priced as (
    select
        h.cnpj_basico,
        p.ticker,
        p.classe,
        p.preco,
        h.qty_preferenciais as quantidade,
        p.preco * h.qty_preferenciais as produto,
        p.preco_date,
        concat(p.price_source, ' + ', h.quantity_source_doc, ' ', h.quantity_source_locator) as source
    from listed_hops h
    inner join prices p 
        on h.cnpj_basico = p.cnpj_basico
        and p.classe = 'preferencial'
    where h.qty_preferenciais is not null
),

all_prices as (
    select * from ordinarias_priced
    union all
    select * from preferenciais_priced
)

select
    cnpj_basico,
    ticker,
    classe,
    preco,
    quantidade,
    produto,
    preco_date,
    source
from all_prices
order by cnpj_basico, classe, preco_date
