select
  '10000000000100' as empresa_id,
  '10000000000100' as cnpj,
  'LISTADA SEMENTE' as razao_social,
  true as em_semente_a,
  cast(['cvm'] as varchar[]) as fontes_semente_b,
  false as nao_caminha
union all
select
  '40000000000100', '40000000000100', 'BANCO SEMENTE', false,
  cast(['bcb'] as varchar[]), false
union all
select
  '60000000000100', '60000000000100', 'SEGURADORA SEMENTE', false,
  cast(['susep'] as varchar[]), false
