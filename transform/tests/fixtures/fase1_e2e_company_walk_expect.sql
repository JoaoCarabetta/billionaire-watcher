select
  '10000000000100' as root_empresa_id,
  '10000000000100' as empresa_id,
  '10000000' as empresa_cnpj8,
  0 as depth
union all
select
  '10000000000100',
  '12000000000100',
  '12000000',
  1
union all
select
  '10000000000100',
  '13000000000100',
  '13000000',
  1
union all
select
  '10000000000100',
  '20000000000100',
  '20000000',
  1
union all
select
  '40000000000100',
  '40000000000100',
  '40000000',
  0
union all
select
  '40000000000100',
  '70000000000100',
  '70000000',
  1
union all
select
  '40000000000100',
  'nome:HOLDINGESTRANGEIRASEMCNPJ',
  cast(null as varchar),
  1
union all
select
  '60000000000100',
  '60000000000100',
  '60000000',
  0
