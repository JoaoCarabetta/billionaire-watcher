{{
    config(
        cluster_by=['cnpj_basico'] if target.type == 'bigquery' else none
    )
}}

with ranked as (
    select
        lpad({{ digits_only('cnpj_basico') }}, 8, '0') as cnpj_basico,
        lpad({{ digits_only('cnpj') }}, 14, '0') as cnpj,
        row_number() over (
            partition by lpad({{ digits_only('cnpj_basico') }}, 8, '0')
            order by
                case
                    when substr(lpad({{ digits_only('cnpj') }}, 14, '0'), 9, 4) = '0001'
                        then 0
                    else 1
                end,
                lpad({{ digits_only('cnpj') }}, 14, '0')
        ) as establishment_row
    from {{ source('br_me_cnpj', 'estabelecimentos') }}
    where
        cast(data as date) = cast('{{ var("rf_partition_date") }}' as date)
        and length({{ digits_only('cnpj_basico') }}) = 8
        and length({{ digits_only('cnpj') }}) = 14
)

select cnpj_basico, cnpj
from ranked
where establishment_row = 1
