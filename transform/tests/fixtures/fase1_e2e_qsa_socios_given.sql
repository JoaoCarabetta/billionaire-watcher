select
  cast('2026-01-11' as date) as data,
  '10000000' as cnpj_basico,
  '2' as tipo,
  'SOCIO QSA IGNORADO PARA LISTADA' as nome,
  '***999999**' as documento,
  '22' as qualificacao
union all
select
  cast('2026-01-11' as date), '40000000', '2',
  'BRUNO SOCIO', '***123456**', '22'
union all
select
  cast('2026-01-11' as date), '40000000', '2',
  'JOAO SILVA', '***111111**', '22'
union all
select
  cast('2026-01-11' as date), '40000000', '2',
  'ADMINISTRADOR NAO SOCIO', '***222222**', '05'
union all
select
  cast('2026-01-11' as date), '40000000', '3',
  'HOLDING QSA INTERMEDIARIA LTDA', '70000000000100', '48'
union all
select
  cast('2026-01-11' as date), '60000000', '2',
  'JOAO SILVA', '***333333**', '22'
union all
select
  cast('2026-01-11' as date), '40000000', '3',
  'SOFIA SOCIA ESTRANGEIRA', cast(null as varchar), '38'
union all
select
  cast('2026-01-11' as date), '40000000', '3',
  'HOLDING ESTRANGEIRA SEM CNPJ', cast(null as varchar), '37'
union all
select
  cast('2026-01-11' as date), '30000000', '2',
  'IRENE PARCEIRA QSA DA FRE', '***987654**', '22'
union all
select
  cast('2026-01-11' as date), '80000000', '2',
  'ALICE CONTROLADORA', '***444777**', '22'
union all
select
  cast('2026-01-11' as date), '80000000', '2',
  'FABIO PARCEIRO DO HOP QSA', '***654321**', '22'
union all
select
  cast('2026-01-11' as date), '81000000', '2',
  'CARLOS OU DAVI COLISAO', '***555666**', '22'
union all
select
  cast('2026-01-11' as date), '81000000', '2',
  'LAURA FORA POR COLISAO', '***112233**', '22'
union all
select
  cast('2026-01-11' as date), '12000000', '2',
  'FELIPE SOCIO DA HOLDING PORTA', '***777888**', '22'
