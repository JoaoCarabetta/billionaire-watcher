-- One-row audit counts for graph_person_tse_match.

select
    count(*) as graph_persons,
    sum(case when is_candidate_strong then 1 else 0 end) as strong_candidate_hits,
    sum(case when is_donor_strong then 1 else 0 end) as strong_donor_hits,
    sum(case when match_class = 'name_review' then 1 else 0 end) as name_only_review,
    sum(case when match_class = 'collision' then 1 else 0 end) as collisions,
    sum(case when match_class = 'no_hit' then 1 else 0 end) as no_hit
from {{ ref('graph_person_tse_match') }}
