// Lists table names (never rows) and the database size. Uses PGURL, else
// DATABASE_URL, so it runs inside the Railway container via `railway ssh`
// (Postgres has no public address).
import pg from "pg";

const url = process.env.PGURL || process.env.DATABASE_URL;
if (!url) { console.error("Neither PGURL nor DATABASE_URL is set."); process.exit(1); }
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
