select
  '10000000000100' as empresa_id,
  '10000000000100' as cnpj,
  cast(1000 as numeric) as valor_do_piso,
  'bolsa_cotahist' as fonte_do_piso,
  true as tem_piso
union all
select
  '40000000000100',
  '40000000000100',
  cast(2000 as numeric),
  'ifdata_ativo_total',
  true
