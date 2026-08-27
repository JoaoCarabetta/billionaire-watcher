-- One optional floor per 14-digit company CNPJ.
-- Cross-family overlap is resolved deterministically: listed market value,
-- then prudential banking assets, then insurance premiums.

with all_floors as (
    select
        cnpj,
        valor_do_piso,
        'bolsa_cotahist' as fonte_do_piso,
        1 as source_priority
    from {{ ref('stg_bolsa_cotahist_piso') }}

    union all

    select
        cnpj,
        valor_do_piso,
        'ifdata_ativo_total' as fonte_do_piso,
        2 as source_priority
    from {{ ref('stg_ifdata_ativo_total_piso') }}

    union all

    select
        cnpj,
        valor_do_piso,
        'susep_premios_emitidos' as fonte_do_piso,
        3 as source_priority
    from {{ ref('stg_susep_premios_emitidos_piso') }}
),

ranked as (
    select
        cnpj,
        valor_do_piso,
        fonte_do_piso,
        row_number() over (
            partition by cnpj
            order by source_priority
        ) as row_number
    from all_floors
    where valor_do_piso is not null
)

select
    cnpj as empresa_id,
    cnpj,
    valor_do_piso,
    fonte_do_piso,
    true as tem_piso
from ranked
where row_number = 1
