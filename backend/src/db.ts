import { PrismaClient } from "@prisma/client";

// Supabase's transaction pooler does not retain named prepared statements
// between transactions. Prisma's pgbouncer flag disables them for the
// application connection. Keep DIRECT_URL unchanged for schema migrations.
function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }
}

const databaseUrl = runtimeDatabaseUrl();
export const prisma = new PrismaClient(
  databaseUrl ? { datasourceUrl: databaseUrl } : undefined,
);
