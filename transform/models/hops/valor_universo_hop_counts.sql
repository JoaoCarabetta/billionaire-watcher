-- Summary counts for the issue #141 hop extract. Grain: one row.
-- hops_landed is ATIVO roots whose listed incoming capital is about 100.
-- explicit_holes is the rest of the hop-root set. already_on_graph_skipped
-- counts those roots even when hops landed (Coder does not redraw /grafo).
-- closed_qsa_companies is distinct closed/group rows in the QSA slice.

with coverage as (
    select * from {{ ref('valor_universo_fre_coverage') }} as coverage
),

closed as (
    select * from {{ ref('valor_universo_closed_qsa') }} as closed
)

select
    {% if target.type == 'duckdb' %}
    count(*) as hop_roots,
    count(*) filter (where coverage.hop_status = 'hops') as hops_landed,
    count(*) filter (where coverage.hop_status = 'hole') as explicit_holes,
    count(*) filter (where coverage.skip_redraw) as already_on_graph_skipped,
    (
        select count(distinct closed.company_name)
        from closed as closed
    ) as closed_qsa_companies,
    (
        select coalesce(sum(per_company.partner_count), 0)
        from (
            select
                closed.company_name,
                max(closed.partner_count) as partner_count
            from closed as closed
            group by closed.company_name
        ) as per_company
    ) as closed_qsa_partner_rows
    {% else %}
    count(*) as hop_roots,
    countif(coverage.hop_status = 'hops') as hops_landed,
    countif(coverage.hop_status = 'hole') as explicit_holes,
    countif(coverage.skip_redraw) as already_on_graph_skipped,
    (
        select count(distinct closed.company_name)
        from closed as closed
    ) as closed_qsa_companies,
    (
        select coalesce(sum(per_company.partner_count), 0)
        from (
            select
                closed.company_name,
                max(closed.partner_count) as partner_count
            from closed as closed
            group by closed.company_name
        ) as per_company
    ) as closed_qsa_partner_rows
    {% endif %}
from coverage as coverage
