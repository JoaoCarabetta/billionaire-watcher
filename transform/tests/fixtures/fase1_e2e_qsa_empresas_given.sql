select
  cast('2026-01-11' as date) as data,
  '10000000' as cnpj_basico,
  'LISTADA SEMENTE S.A.' as razao_social,
  '2046' as natureza_juridica
union all
select
  cast('2026-01-11' as date), '40000000', 'BANCO SEMENTE', '2062'
union all
select
  cast('2026-01-11' as date), '60000000', 'SEGURADORA SEMENTE', '2062'
union all
select
  cast('2026-01-11' as date), '70000000', 'HOLDING QSA INTERMEDIARIA LTDA', '2062'
union all
select
  cast('2026-01-11' as date), '30000000', 'HOP FRE S.A.', '2046'
union all
select
  cast('2026-01-11' as date), '80000000', 'HOP QSA LTDA', '2062'
union all
select
  cast('2026-01-11' as date), '81000000', 'MASCARA EM COLISAO LTDA', '2062'
