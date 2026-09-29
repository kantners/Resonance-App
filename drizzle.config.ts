import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against migrations/ and needs
// no database. `migrate` (and anything else that connects) needs DATABASE_URL.
const needsDb = !process.argv.includes("generate");
if (needsDb && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Provide a Postgres connection string.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
