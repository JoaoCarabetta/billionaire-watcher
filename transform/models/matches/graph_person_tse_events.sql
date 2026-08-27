-- Privacy boundary for graph-person Tribunal matching.
-- The raw document is used only to derive p- plus eight hex and is never output.
-- The 2026 source contract expects the real Dados Abertos snapshot tables
-- documented in sources.yml; no fixture receipts are substituted on dev.

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
        ano as cycle,
        'candidate' as event_kind,
        nome as person_name,
        regexp_replace(cast(cpf as string), '[^0-9]', '') as cpf_digits
    from {{ source('tse_2026_snapshot', 'candidatos_2026_10_04') }}
    where ano = 2026
),

tse_2026_donors as (
    select
        ano as cycle,
        'donor' as event_kind,
        nome_doador as person_name,
        regexp_replace(cast(cpf_cnpj_doador as string), '[^0-9]', '') as cpf_digits
    from {{ source('tse_2026_snapshot', 'receitas_candidato_2026_10_04') }}
    where ano = 2026
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
