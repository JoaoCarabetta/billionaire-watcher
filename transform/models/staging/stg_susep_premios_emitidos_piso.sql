-- One annual-to-date premiums floor per 14-digit insurer CNPJ.
-- The source is ReceitasSeguros.valor (premios emitidos), not SES premio_ganho.

with normalized as (
    select
        lpad({{ digits_only('cnpj') }}, 14, '0') as cnpj,
        cast(valor as numeric) as valor
    from {{ source('fase1_landing', 'susep_receitas_seguros_2026') }}
    where
        length({{ digits_only('cnpj') }}) between 1 and 14
        and valor is not null
)

select
    cnpj,
    cast(sum(valor) as numeric) as valor_do_piso
from normalized
group by cnpj
