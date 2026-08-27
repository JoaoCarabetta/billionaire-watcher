-- Privacy boundary for graph-person Tribunal matching.
-- The raw document is used only to derive p- plus eight hex and is never output.
-- There is no real 2026 Dados Abertos landing under
-- gs://billionairewatcher-landing. The 2026 CTEs stay explicitly empty until
-- that landing exists; no object/table path or fixture receipt is invented.

with closed_candidates as (
    select
        ano as cycle,
        'candidate' as event_kind,
        nome as person_name,
        regexp_replace(cast(cpf as string), '[^0-9]', '') as cpf_digits
    from {{ source('br_tse_eleicoes', 'candidatos') }}
    where ano in (2016, 2018, 2020, 2022, 2024)
),

closed_donors as (
    select
        ano as cycle,
        'donor' as event_kind,
        nome_doador as person_name,
        regexp_replace(cast(cpf_cnpj_doador as string), '[^0-9]', '') as cpf_digits
    from {{ source('br_tse_eleicoes', 'receitas_candidato') }}
    where ano in (2016, 2018, 2020, 2022, 2024)
),

tse_2026_candidates as (
    select
        cast(null as integer) as cycle,
        cast(null as string) as event_kind,
        cast(null as string) as person_name,
        cast(null as string) as cpf_digits
    where false
),

tse_2026_donors as (
    select
        cast(null as integer) as cycle,
        cast(null as string) as event_kind,
        cast(null as string) as person_name,
        cast(null as string) as cpf_digits
    where false
),

all_events as (
    select * from closed_candidates
    union all
    select * from closed_donors
    union all
    select * from tse_2026_candidates
    union all
    select * from tse_2026_donors
),

eligible_events as (
    select
        {{ person_id_from_cpf('cpf_digits') }} as person_id,
        {{ normalize_person_name('person_name') }} as normalized_name,
        cycle,
        event_kind
    from all_events
    -- Masked Base dos Dados donor documents cannot become strong keys and are
    -- intentionally absent from name review because no distinct hash exists.
    where length(cpf_digits) = 11
      and person_name is not null
)

select distinct
    person_id,
    normalized_name,
    cycle,
    event_kind
from eligible_events
where normalized_name <> ''
