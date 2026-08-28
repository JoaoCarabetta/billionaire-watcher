select
  '10000000000100' as from_id,
  '12000000000100' as to_id,
  'fre' as fonte,
  15.0 as percentual_total
union all
select
  '10000000000100',
  '13000000000100',
  'fre',
  5.0
union all
select
  '10000000000100',
  '20000000000100',
  'fre',
  60.0
union all
select
  '40000000',
  '70000000000100',
  'qsa',
  cast(null as double)
union all
select
  '40000000',
  'nome:HOLDINGESTRANGEIRASEMCNPJ',
  'qsa',
  cast(null as double)
