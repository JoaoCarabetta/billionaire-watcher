select
  'p-8c2d3a75' as pessoa_id,
  'ALICE CONTROLADORA' as nome,
  '11144477735' as cpf,
  cast(null as varchar) as filiacao,
  cast(null as date) as data_nascimento,
  true as e_oligarca,
  cast(50 as numeric) as fortuna_valor,
  true as fortuna_incompleta
union all
select
  'p-f0a39f5c', 'CARLOS CPF COLISAO', '12355566600', null, null,
  true, 10, false
union all
select
  'p-20953853', 'DAVI CPF COLISAO', '98755566611', null, null,
  true, 10, false
union all
select
  'p-provisorio-5244e17e4d3e00aa', 'CAMILA CITADA', null, null, null,
  false, 49, false
union all
select
  'p-provisorio-38456fff6f5e6fd9', 'DIANA HOLDING', null, null, null,
  true, 480, false
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
union all
select
  'p-provisorio-5ef96a534f962d30', 'SOFIA SOCIA ESTRANGEIRA',
  null, null, null, false, null, true
union all
select
  'p-provisorio-ff84fed3d3bd953a', 'FELIPE SOCIO DA HOLDING PORTA',
  null, null, null, true, null, true
union all
select
  'p-provisorio-46a7c8979f5f35ea', 'JOSE CITADO NA ARVORE',
  null, null, null, true, cast(148.5 as numeric), false
union all
select
  'p-provisorio-c46282f6d5a5ac6d', 'INES CONTROLADORA SEM PORTA',
  null, null, null, false, 40, false
