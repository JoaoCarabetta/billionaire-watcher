# Local Memgraph

Scratch pad for Cypher walks on the frozen v0 public graph. The warehouse walk in [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md) stays the source of truth.

```sh
cd graph
docker compose up -d
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python load_grafo_publico.py
```

- Bolt: `bolt://localhost:7687` (no auth)
- Lab: http://localhost:3001

Paste [lab-style.gss](lab-style.gss) into Lab’s Graph Style editor so nodes and edges show names instead of ids. Example walk:

```cypher
MATCH path = (c:Empresa {id: "00864214000106"})<-[:OWNS*1..3]-(n)
RETURN path
```

Load is a copy of [public/grafo-publico.json](../public/grafo-publico.json) (`Pessoa` / `Empresa` / `OWNS`). Not the full Receita QSA.
