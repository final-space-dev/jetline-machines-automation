/**
 * BMS MySQL Connection Manager
 * Handles connections to multiple BMS company databases
 */

import mysql, { Pool, PoolOptions, RowDataPacket } from "mysql2/promise";
import { BMSConnectionConfig } from "./types";

// Default BMS database credentials
const DEFAULT_BMS_USER = process.env.BMS_DB_USER || "fortyone";
const DEFAULT_BMS_PASSWORD = process.env.BMS_DB_PASSWORD || "fo123@!";
const DEFAULT_BMS_PORT = parseInt(process.env.BMS_DB_PORT || "3306", 10);

// Connection pool cache
const connectionPools: Map<string, Pool> = new Map();

/**
 * Get or create a connection pool for a BMS database
 */
export async function getBMSConnection(config: BMSConnectionConfig): Promise<Pool> {
  const poolKey = `${config.host}:${config.port}/${config.schema}`;

  // Return existing pool if available
  if (connectionPools.has(poolKey)) {
    return connectionPools.get(poolKey)!;
  }

  const poolConfig: PoolOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.schema,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };

  const pool = mysql.createPool(poolConfig);

  // Test connection
  try {
    const conn = await pool.getConnection();
    conn.release();
    connectionPools.set(poolKey, pool);
    return pool;
  } catch (error) {
    throw new Error(
      `Failed to connect to BMS database ${config.schema}@${config.host}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a BMS connection config from company info
 */
export function createBMSConfig(
  bmsSchema: string,
  bmsHost: string | null
): BMSConnectionConfig {
  // Derive host from schema name if not provided
  // Pattern: "menlynbms2" -> "menlyn.jetlinestores.co.za"
  const derivedHost = bmsHost || deriveHostFromSchema(bmsSchema);

  return {
    schema: bmsSchema,
    host: derivedHost,
    port: DEFAULT_BMS_PORT,
    user: DEFAULT_BMS_USER,
    password: DEFAULT_BMS_PASSWORD,
  };
}

/**
 * Derive hostname from BMS schema name
 * e.g., "menlynbms2" -> "menlyn.jetlinestores.co.za"
 */
function deriveHostFromSchema(schema: string): string {
  // Remove 'bms' suffix and any numbers
  const storeName = schema.replace(/bms\d*$/i, "").toLowerCase();
  return `${storeName}.jetlinestores.co.za`;
}

/**
 * Execute a query on a BMS database
 */
export async function queryBMS<T extends RowDataPacket>(
  config: BMSConnectionConfig,
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = await getBMSConnection(config);
  const [rows] = await pool.query<T[]>(query, params);
  return rows;
}

/**
 * Test connection to a BMS database
 */
export async function testBMSConnection(
  config: BMSConnectionConfig
): Promise<{ success: boolean; error?: string; latency?: number }> {
  const startTime = Date.now();

  try {
    const pool = await getBMSConnection(config);
    const conn = await pool.getConnection();
    conn.release();

    return {
      success: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Close all connection pools
 */
export async function closeAllBMSConnections(): Promise<void> {
  for (const [key, pool] of connectionPools) {
    try {
      await pool.end();
    } catch (error) {
      console.error(`Error closing pool ${key}:`, error);
    }
  }
  connectionPools.clear();
}

/**
 * Close a specific connection pool
 */
export async function closeBMSConnection(
  config: BMSConnectionConfig
): Promise<void> {
  const poolKey = `${config.host}:${config.port}/${config.schema}`;
  const pool = connectionPools.get(poolKey);

  if (pool) {
    await pool.end();
    connectionPools.delete(poolKey);
  }
}
