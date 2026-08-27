select empresa_id as root_empresa_id
from {{ ref('empresas') }}
where motivo_entrada = 'semente' and not nao_caminha
