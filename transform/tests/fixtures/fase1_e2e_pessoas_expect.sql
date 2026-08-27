select
  'p-8c2d3a75' as pessoa_id,
  'ALICE CONTROLADORA' as nome,
  '11144477735' as cpf,
  cast(null as varchar) as filiacao,
  cast(null as date) as data_nascimento,
  true as e_oligarca,
  cast(null as numeric) as fortuna_valor,
  true as fortuna_incompleta
union all
select
  'p-provisorio-5244e17e4d3e00aa', 'CAMILA CITADA', null, null, null,
  false, null, true
union all
select
  'p-provisorio-38456fff6f5e6fd9', 'DIANA HOLDING', null, null, null,
  false, null, true
union all
select
  'p-provisorio-9c05347c3655101e', 'BRUNO SOCIO', null, null, null,
  false, null, true
union all
select
  'p-provisorio-bffaca71701a4644', 'JOAO SILVA', null, null, null,
  false, null, true
union all
select
  'p-provisorio-50179797a332df8b', 'JOAO SILVA', null, null, null,
  false, null, true
union all
select
  'p-d9aa06c1', 'ELENA PARCEIRA DO HOP', '22255588800', null, null,
  false, null, true
union all
select
  'p-provisorio-53c0e5d1dcd6f9a4', 'IRENE PARCEIRA QSA DA FRE',
  null, null, null, false, null, true
union all
select
  'p-provisorio-4dbf258275ee4ca5', 'FABIO PARCEIRO DO HOP QSA',
  null, null, null, false, null, true
