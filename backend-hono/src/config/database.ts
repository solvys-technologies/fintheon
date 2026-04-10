/**
 * Database Configuration
 * Supports both Neon (cloud) and local PostgreSQL
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import pg from "pg";
import dns from "node:dns";

// Supabase direct connections only have IPv6 (AAAA) records — force Node to try IPv6 first
dns.setDefaultResultOrder("verbatim");

// Check NEON_DATABASE_URL first (preferred), then fallback to DATABASE_URL
const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    "[DB] No database URL set - database features will be unavailable",
  );
}

// Detect Neon vs Supabase vs local PostgreSQL
const isNeonUrl =
  DATABASE_URL?.includes(".neon.tech") || DATABASE_URL?.includes("neon.tech");
const isSupabaseUrl = DATABASE_URL?.includes(".supabase.co");

// Neon uses its own serverless driver. Supabase and local use pg Pool.
let neonSql: NeonQueryFunction<false, false> | null = null;
let pgPool: pg.Pool | null = null;
// pgAvailable: only set to true after a successful ping — prevents treating a non-running
// PostgreSQL as "available" and causing 500s instead of graceful in-memory fallback.
let pgAvailable = false;

if (DATABASE_URL) {
  if (isNeonUrl) {
    neonSql = neon(DATABASE_URL);
    console.log("[DB] Using Neon serverless driver");
  } else {
    // Supabase and local both use pg Pool. Supabase requires SSL.
    const poolConfig: pg.PoolConfig = { connectionString: DATABASE_URL };
    if (isSupabaseUrl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    pgPool = new pg.Pool(poolConfig);
    const label = isSupabaseUrl ? "Supabase" : "local PostgreSQL";
    console.log(`[DB] Using pg Pool for ${label} — pinging...`);
    pgPool
      .query("SELECT 1")
      .then(() => {
        pgAvailable = true;
        console.log(`[DB] ${label} connected`);
      })
      .catch((err) => {
        console.warn(
          `[DB] ${label} not reachable — falling back to in-memory store`,
          err?.message,
        );
      });
  }
}

// Unified SQL function that works with both drivers
// Returns any[] to match Neon's behavior and allow type assertions
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<any[]> {
  if (neonSql) {
    const result = await neonSql(strings, ...values);
    return result as any[];
  }

  if (pgPool) {
    // Convert template literal to parameterized query
    let query = "";
    const params: unknown[] = [];
    strings.forEach((str, i) => {
      query += str;
      if (i < values.length) {
        params.push(values[i]);
        query += `$${params.length}`;
      }
    });

    const result = await pgPool.query(query, params);
    return result.rows;
  }

  throw new Error("Database not configured");
}

export function isDatabaseAvailable(): boolean {
  return neonSql !== null || pgAvailable;
}
