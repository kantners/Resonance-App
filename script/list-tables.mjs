// Lists table names (never rows) in the database at PGURL. Used by
// handoff/deploy-staging.ps1 to check Postgres before the first migration.
import pg from "pg";

const url = process.env.PGURL;
if (!url) { console.error("PGURL is not set."); process.exit(1); }
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const r = await client.query(
    "select table_schema || '.' || table_name as t from information_schema.tables " +
    "where table_schema not in ('pg_catalog','information_schema') order by 1");
  console.log(r.rows.length ? r.rows.map((x) => x.t).join("\n") : "(no tables)");
  const s = await client.query("select pg_size_pretty(pg_database_size(current_database())) as size");
  console.log(`database size: ${s.rows[0].size}`);
} catch (e) {
  console.error(`Could not read the database: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
