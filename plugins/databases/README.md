# databases

This plugin adds seven database specialists for PostgreSQL, MongoDB, Neo4j, Cassandra, MariaDB, cross-engine SQL tuning and vector search. They help with schema design, slow queries, indexes, replication and clustering.

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

## Try it

- *"Have db-postgres-expert find out why the monthly revenue query in reports/monthly.sql takes 40 seconds."* The agent works from the query, the schema and the `EXPLAIN ANALYZE` plan, and proposes index or query changes.
- *"Ask db-mongodb-expert to redesign the orders collection so the dashboard's aggregation stops scanning every document."* The agent proposes a document model, the indexes it needs and an aggregation pipeline that uses them.
- *"Use db-vector-expert to choose between pgvector and Qdrant for 20 million 768-dimension embeddings."* The agent compares the two for that data size and recommends one, with an index configuration to start from.

## Agents

Claude Code lists each agent as `databases:<name>`, for example `databases:db-postgres-expert`.

| Agent | Use it for |
|---|---|
| `db-postgres-expert` | PostgreSQL 16+: query and index tuning, replication, high availability, architecture. |
| `db-mongodb-expert` | MongoDB 6 and 7: document modeling, aggregation pipelines, sharding, indexing. |
| `db-neo4j-expert` | Neo4j 5: graph modeling, Cypher, GDS algorithms, APOC. |
| `db-cassandra-expert` | Cassandra 4 and 5: data modeling, CQL, cluster configuration and tuning. |
| `db-mariadb-expert` | MariaDB 10 and 11: replication, Galera clustering, performance. |
| `db-sql-expert` | Advanced SQL and execution-plan tuning across PostgreSQL, MySQL/MariaDB, SQL Server and Oracle. |
| `db-vector-expert` | Vector search with pgvector, Pinecone, Weaviate, Qdrant and FAISS: embeddings, indexing, tuning. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Can the agents run queries against my database?** Yes, through Bash, when the client such as `psql`, `mongosh` or `cqlsh` is installed. Claude Code asks before each command your permission settings don't already allow, so you see every query first. Point them at a development database rather than production.

**Do the agents need Context7?** No, but they use it when it's there. Every agent here can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
