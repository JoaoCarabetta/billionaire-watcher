with expected_quotes as (
    select '00864214' as cnpj_basico, 'ENGI11' as ticker, 'unit' as classe
    union all select '00864214', 'ENGI3', 'ordinaria'
    union all select '00864214', 'ENGI4', 'preferencial'
    union all select '07689002', 'EMBR3', 'ordinaria'
    union all select '33592510', 'VALE3', 'ordinaria'
    union all select '03220438', 'EQTL3', 'ordinaria'
    union all select '34274233', 'VBBR3', 'ordinaria'
    union all select '07415333', 'SIMH3', 'ordinaria'
    union all select '01838723', 'BRFS3', 'ordinaria'
    union all select '17155730', 'CMIG3', 'ordinaria'
    union all select '17155730', 'CMIG4', 'preferencial'
    union all select '01083200', 'NEOE3', 'ordinaria'
    union all select '43776517', 'SBSP3', 'ordinaria'
    union all select '06057223', 'ASAI3', 'ordinaria'
    union all select '02916265', 'JBSS3', 'ordinaria'
    union all select '33453598', 'RAIZ4', 'preferencial'
    union all select '33611500', 'GGBR3', 'ordinaria'
    union all select '33611500', 'GGBR4', 'preferencial'
    union all select '50746577', 'CSAN3', 'ordinaria'
    union all select '06047087', 'RDOR3', 'ordinaria'
    union all select '02558157', 'VIVT3', 'ordinaria'
    union all select '61585865', 'RADL3', 'ordinaria'
    union all select '42150391', 'BRKM3', 'ordinaria'
    union all select '42150391', 'BRKM5', 'preferencial'
    union all select '47960950', 'MGLU3', 'ordinaria'
    union all select '33042730', 'CSNA3', 'ordinaria'
    union all select '33256439', 'UGPA3', 'ordinaria'
    union all select '67620377', 'BEEF3', 'ordinaria'
    union all select '16404287', 'SUZB3', 'ordinaria'
    union all select '02429144', 'CPFE3', 'ordinaria'
    union all select '00001180', 'ELET3', 'ordinaria'
    union all select '00001180', 'ELET6', 'preferencial'
    union all select '16670085', 'RENT3', 'ordinaria'
    union all select '33000167', 'PETR3', 'ordinaria'
    union all select '33000167', 'PETR4', 'preferencial'
    union all select '03853896', 'MRFG3', 'ordinaria'
    union all select '24990777', 'GMAT3', 'ordinaria'
    union all select '84429695', 'WEGE3', 'ordinaria'
    union all select '07526557', 'ABEV3', 'ordinaria'
),

actual_quotes as (
    select
        cnpj_basico,
        ticker,
        classe,
        preco,
        preco_date,
        source
    from {{ ref('b3_listed_prices') }}
),

missing_quotes as (
    select
        'missing_quote' as violation,
        e.cnpj_basico,
        e.ticker,
        e.classe
    from expected_quotes e
    left join actual_quotes a
        on e.cnpj_basico = a.cnpj_basico
        and e.ticker = a.ticker
        and e.classe = a.classe
    where a.ticker is null
),

unexpected_quotes as (
    select
        'unexpected_quote' as violation,
        a.cnpj_basico,
        a.ticker,
        a.classe
    from actual_quotes a
    left join expected_quotes e
        on e.cnpj_basico = a.cnpj_basico
        and e.ticker = a.ticker
        and e.classe = a.classe
    where e.ticker is null
),

duplicate_quotes as (
    select
        'duplicate_quote' as violation,
        cnpj_basico,
        ticker,
        classe
    from actual_quotes
    group by cnpj_basico, ticker, classe, preco_date
    having count(*) > 1
),

invalid_quotes as (
    select
        'invalid_quote' as violation,
        cnpj_basico,
        ticker,
        classe
    from actual_quotes
    where preco is null
        or preco <= 0
        or preco_date <> '2025-05-16'
        or source <> 'Brasil Bolsa Balcão'
        or source = 'Recorded fixture quote'
        or cnpj_basico = '07043628'
)

select * from missing_quotes
union all
select * from unexpected_quotes
union all
select * from duplicate_quotes
union all
select * from invalid_quotes
