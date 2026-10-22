# databases

Database specialists for SQL, NoSQL, graph and vector stores.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `db-postgres-expert` | PostgreSQL 16+: query and index tuning, replication, architecture. |
| `db-mongodb-expert` | MongoDB 6/7: document modeling, aggregation pipelines, sharding, indexing. |
| `db-neo4j-expert` | Neo4j 5: graph modeling, Cypher, GDS algorithms, APOC. |
| `db-cassandra-expert` | Cassandra 4/5: data modeling, CQL, cluster configuration and tuning. |
| `db-mariadb-expert` | MariaDB 10/11: replication, Galera clustering, performance. |
| `db-sql-expert` | Advanced SQL and execution-plan tuning across PostgreSQL, MySQL/MariaDB, SQL Server and Oracle. |
| `db-vector-expert` | Vector search with pgvector, Pinecone, Weaviate, Qdrant and FAISS: embeddings, indexing, tuning. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use db-postgres-expert to …") or choose it from `/agents`.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install databases --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install databases@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **databases**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).
