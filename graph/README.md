# Local Memgraph

Scratch pad for Cypher walks. The warehouse in [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md) is the source of truth. Memgraph is not a warehouse input.

Two loaders (each wipes the store first):

| Script | Source | Use |
|---|---|---|
| `load_marts.py --graph complete` | BigQuery `marts.empresas` / `pessoas` / `vinculos` | One edge per warehouse path line (`CONTROLADOR` / `ACIONISTA` / `SOCIO`). No CPF. |
| `load_marts.py --graph simplified` | same | Reserved (collapse identical FRE repeats). |
| `load_grafo_publico.py` | [grafo-publico.json](grafo-publico.json) | Frozen v0 snapshot (`Pessoa` / `Empresa` / `OWNS`). Do not rewrite to match the spec. |

```sh
cd graph
docker compose up -d
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# complete walk (needs ADC or service_accounts/…json)
.venv/bin/python load_marts.py --graph complete
# or the frozen v0 graph
.venv/bin/python load_grafo_publico.py
```

- Bolt: `bolt://localhost:7687` (no auth)
- Lab: http://localhost:3001

Paste [lab-style.gss](lab-style.gss) into Lab’s Graph Style editor (it replaces the style Lab generates from labels). Names are truncated. On a walk with more than 18 nodes, holdings and stops stay unlabeled so the cluster is readable — click a node for the full name. Edge text only appears on small graphs; a thick black line is `CONTROLADOR`.

| Type | Labels | Color | Shape |
|---|---|---|---|
| Person | `Pessoa` | green | circle |
| Seed A company | `Empresa` + `Semente` | red | square |
| Walk-up holding | `Empresa` + `Holding` | amber | diamond |
| State | `Estado` | blue | triangle |
| Stop (Outros, treasury, unresolved, foreign) | `Parada` | gray (brown / purple by `tipo`) | triangle down |

`MATCH (e:Empresa)` still returns both seed companies and holdings. Narrow with `MATCH (h:Holding)` or `MATCH (s:Semente)`.

```cypher
MATCH path = (e:Empresa {id: "02916265000160"})<-[*1..4]-(n)
RETURN path
```
