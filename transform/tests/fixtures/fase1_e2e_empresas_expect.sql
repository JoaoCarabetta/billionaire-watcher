select
  '10000000000100' as empresa_id,
  '10000000000100' as cnpj,
  'LISTADA SEMENTE' as razao_social,
  true as em_semente_a,
  cast(['cvm'] as varchar[]) as fontes_semente_b,
  'semente' as motivo_entrada,
  false as nao_caminha,
  cast(1000 as numeric) as valor_do_piso,
  'bolsa_cotahist' as fonte_do_piso,
  true as tem_piso
union all
select
  '40000000000100', '40000000000100', 'BANCO SEMENTE', false,
  cast(['bcb'] as varchar[]), 'semente', false,
  cast(2000 as numeric), 'ifdata_ativo_total', true
union all
select
  '60000000000100', '60000000000100', 'SEGURADORA SEMENTE', false,
  cast(['susep'] as varchar[]), 'semente', false, null, null, false
union all
select
  '20000000000100', '20000000000100',
  'HOLDING PUBLICA INTERMEDIARIA S.A.', false,
  cast([] as varchar[]), 'subida', false, null, null, false
union all
select
  '70000000000100', '70000000000100',
  'HOLDING QSA INTERMEDIARIA LTDA', false,
  cast([] as varchar[]), 'subida', false, null, null, false
union all
select
  '30000000000100', '30000000000100',
  'HOP FRE S.A.', false,
  cast([] as varchar[]), 'hop', false, null, null, false
union all
select
  '80000000000100', '80000000000100',
  'HOP QSA LTDA', false,
  cast([] as varchar[]), 'hop', false, null, null, false
union all
select
  'nome:HOLDINGESTRANGEIRASEMCNPJ', null,
  'HOLDING ESTRANGEIRA SEM CNPJ', false,
  cast([] as varchar[]), 'subida', false, null, null, false
