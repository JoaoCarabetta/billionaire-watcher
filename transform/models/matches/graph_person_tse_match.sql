-- One row per person already present on the public graph.
-- Only the p-id join below can set candidate/donor badge-class fields.

with graph_people as (
    select
        person_id,
        label,
        {{ normalize_person_name('label') }} as normalized_name
    from {{ ref('live_graph_person_ids') }}
),

tse_events as (
    select
        person_id,
        normalized_name,
        cycle,
        event_kind
    from {{ ref('graph_person_tse_events') }}
),

strong_by_person as (
    select
        person_id,
        sum(case when event_kind = 'candidate' then 1 else 0 end) as candidate_events,
        sum(case when event_kind = 'donor' then 1 else 0 end) as donor_events,
        string_agg(
            distinct case when event_kind = 'candidate' then cast(cycle as string) end,
            ','
            order by case when event_kind = 'candidate' then cast(cycle as string) end
        ) as candidate_cycles,
        string_agg(
            distinct case when event_kind = 'donor' then cast(cycle as string) end,
            ','
            order by case when event_kind = 'donor' then cast(cycle as string) end
        ) as donor_cycles
    from tse_events
    group by person_id
),

name_identity_counts as (
    select
        normalized_name,
        count(distinct person_id) as distinct_person_ids
    from tse_events
    where normalized_name is not null
      and normalized_name <> ''
    group by normalized_name
),

classified as (
    select
        graph.person_id,
        graph.label,
        coalesce(strong.candidate_events, 0) > 0 as is_candidate_strong,
        coalesce(strong.donor_events, 0) > 0 as is_donor_strong,
        strong.candidate_cycles,
        strong.donor_cycles,
        case
            when coalesce(strong.candidate_events, 0) > 0
              or coalesce(strong.donor_events, 0) > 0
                then 'strong'
            when names.distinct_person_ids = 1
                then 'name_review'
            when names.distinct_person_ids >= 2
                then 'collision'
            else 'no_hit'
        end as match_class
    from graph_people as graph
    left join strong_by_person as strong
        on graph.person_id = strong.person_id
    left join name_identity_counts as names
        on graph.normalized_name = names.normalized_name
)

select
    person_id,
    label,
    is_candidate_strong,
    is_donor_strong,
    candidate_cycles,
    donor_cycles,
    match_class
from classified
