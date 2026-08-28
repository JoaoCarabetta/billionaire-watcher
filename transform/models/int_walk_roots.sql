select empresa_id as root_empresa_id
from {{ ref('int_seed_companies') }}
where not nao_caminha
