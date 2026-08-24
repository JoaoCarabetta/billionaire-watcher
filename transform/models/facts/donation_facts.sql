-- donation_facts.sql
-- TSE campaign donation facts for freeze persons
-- One fact per receipt (person×candidate×cycle receipt grain, matching HTML fixture table)
-- Published facts ONLY for freeze_status=in
-- PJ donations banned since 2016; 2026 is PF/campaign/party only

with freeze_persons as (
    select * from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Published facts only
      and person_name is not null
      and cpf_masked is not null -- Must have CPF to match TSE
),

-- 2026 donations from seed (open cycle, not in BD yet)
tse_2026 as (
    select
        ano,
        nome_candidato,
        nome_doador,
        cpf_doador_masked,
        valor_receita,
        tipo_receita,
        fonte_receita,
        numero_recibo_eleitoral
    from {{ ref('tse_donations_2026') }}
    where ano = 2026
      and fonte_receita = 'Pessoa física' -- PF only (PJ banned since 2016)
      and numero_recibo_eleitoral is not null -- Must have receipt number for source_locator
      and nome_candidato is not null -- Must have candidate name for public facts
),

-- Closed cycles from BD br_tse_eleicoes (2014, 2018, 2022)
-- NOTE: In unit tests, use seed/fixture only. No live BD call.
tse_closed_cycles as (
    {% if target.name in ('test', 'ci') %}
    -- Unit tests: empty CTE (no live BD calls in tests)
    select
        cast(null as int64) as ano,
        cast(null as string) as nome_candidato,
        cast(null as string) as nome_doador,
        cast(null as string) as cpf_doador_masked,
        cast(null as double) as valor_receita,
        cast(null as string) as tipo_receita,
        cast(null as string) as fonte_receita,
        cast(null as string) as numero_recibo_eleitoral
    where false
    {% else %}
    -- Production: query BD for closed cycles
    select
        ano,
        nome_candidato,
        nome_doador,
        cpf_cnpj_doador as cpf_doador_masked,
        valor_receita,
        tipo_receita,
        fonte_receita,
        numero_recibo_eleitoral
    from {{ source('br_tse_eleicoes', 'receitas_candidato') }}
    where ano in (2014, 2018, 2022)
      and fonte_receita = 'Pessoa física' -- PF only
      and numero_recibo_eleitoral is not null
      and nome_candidato is not null -- Must have candidate name for public facts
    {% endif %}
),

all_tse_donations as (
    select * from tse_2026
    union all
    select * from tse_closed_cycles
),

-- Match freeze persons to TSE donations on cpf_masked
matched_donations as (
    select
        f.person_name,
        f.cpf_masked,
        f.cnpj_basico,
        f.group_name,
        d.ano,
        d.nome_candidato,
        d.nome_doador,
        d.valor_receita,
        d.tipo_receita,
        d.numero_recibo_eleitoral
    from freeze_persons f
    inner join all_tse_donations d
        on f.cpf_masked = d.cpf_doador_masked
),

donation_facts_base as (
    select
        concat(
            'donation_',
            numero_recibo_eleitoral,
            '_',
            person_name
        ) as fact_id,
        person_name,
        'donation' as fact_kind,
        concat(
            person_name,
            ' doou R$ ',
            cast(valor_receita as string),
            ' para ',
            nome_candidato,
            ' em ',
            cast(ano as string),
            ' (recibo ',
            numero_recibo_eleitoral,
            ')'
        ) as value,
        'Tribunal Superior Eleitoral' as source_publisher,
        concat(
            'TSE Receitas Candidato ',
            cast(ano as string),
            ' recibo ',
            numero_recibo_eleitoral
        ) as source_locator,
        null as source_retrieved_at, -- No fake timestamp
        cpf_masked,
        cnpj_basico,
        group_name
    from matched_donations
    where numero_recibo_eleitoral is not null -- Final guard: drop if no source_locator
)

select
    fact_id,
    person_name,
    fact_kind,
    value,
    source_publisher,
    source_locator,
    source_retrieved_at,
    cpf_masked,
    cnpj_basico,
    group_name
from donation_facts_base
