select
  '02916265000160' as empresa_id,
  '02916265000160' as cnpj,
  'JBS' as razao_social,
  true as em_semente_a,
  cast(['cvm', 'susep'] as varchar[]) as fontes_semente_b,
  false as nao_caminha
union all
select
  '00123456000199', '00123456000199', 'COMPANHIA ATIVA COM ZERO', false,
  cast(['cvm'] as varchar[]), false
union all
select
  '01234567000189', '01234567000189', 'BANCO COM ZERO INICIAL', false,
  cast(['bcb'] as varchar[]), false
union all
select
  '00999999000199', '00999999000199', 'SEGURADORA COM ZERO INICIAL', false,
  cast(['susep'] as varchar[]), false
union all
select
  'nome:NATURAECO', null, 'Natura & Co.', true,
  cast([] as varchar[]), true
union all
select
  '11222333000144', '11222333000144', 'Globo', true,
  cast([] as varchar[]), true
union all
select
  'nome:HAVAN', null, 'Havan', true,
  cast([] as varchar[]), true
union all
select
  'nome:RECORD', null, 'Record', true,
  cast([] as varchar[]), true
union all
select
  'nome:FOLHA', null, 'Folha', true,
  cast([] as varchar[]), true
