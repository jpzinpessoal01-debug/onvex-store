import type { D1PreparedStatement, D1Result } from "@cloudflare/workers-types";

type NeonClient = {
  query: (config: { text: string; values?: unknown[]; rowMode?: "array" | "object" }) => Promise<{
    rows: unknown[];
    rowCount?: number | null;
  }>;
  connect: () => Promise<NeonPoolClient>;
};

type NeonPoolClient = NeonClient & {
  release: () => void;
};

type QueryMode = "objects" | "arrays";

function replaceQuestionMarks(query: string): string {
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;
  let output = "";

  for (let position = 0; position < query.length; position += 1) {
    const character = query[position];
    const next = query[position + 1];

    if (quote) {
      output += character;
      if (character === quote && next === quote) {
        output += next;
        position += 1;
      } else if (character === quote && query[position - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      output += character;
      continue;
    }

    if (character === "?") {
      index += 1;
      output += `$${index}`;
    } else {
      output += character;
    }
  }

  // SQLite accepts max(value, 0) as a scalar function. PostgreSQL calls the
  // equivalent GREATEST function. Keep aggregate max(column) untouched.
  return output
    .replace(/max\(sales_count-\$(\d+),0\)/gi, "GREATEST(sales_count-$1,0)")
    .replace(/max\(current_uses-1,0\)/gi, "GREATEST(current_uses-1,0)")
    .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP::text")
    .replace(/datetime\(([^)]+)\)/gi, "$1")
    .replace(/\bAS\s+([A-Za-z_][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)/g, 'AS "$1"');
}

function resultMeta(rowCount: number | null | undefined): D1Result<unknown>["meta"] {
  return {
    changes: rowCount ?? 0,
    changed_db: true,
    last_row_id: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: rowCount ?? 0,
    duration: 0,
  };
}

class NeonPreparedStatement implements D1PreparedStatement {
  private readonly values: unknown[];

  constructor(
    readonly database: NeonD1Compat,
    readonly query: string,
    values: unknown[] = [],
  ) {
    this.values = values.map((value) => (value === undefined ? null : value));
  }

  get boundValues(): readonly unknown[] {
    return this.values;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new NeonPreparedStatement(this.database, this.query, values);
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const result = await this.database.execute(this.query, this.values, "objects");
    const row = result.results[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    if (columnName) return (row[columnName] as T | undefined) ?? null;
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.database.execute(this.query, this.values, "objects") as Promise<D1Result<T>>;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.database.execute(this.query, this.values, "objects") as Promise<D1Result<T>>;
  }

  async raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  async raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    const result = await this.database.execute(this.query, this.values, "arrays");
    // Drizzle never asks for column names. Keep the overload useful for code
    // that does while avoiding a second network round-trip in the adapter.
    if (options?.columnNames) return [[] as string[], ...result.results as T[]];
    return result.results as T[];
  }
}

/**
 * Small D1-compatible adapter backed by Neon Postgres.
 *
 * Keeping the D1 surface here lets the existing Drizzle SQLite query layer
 * continue to serve the Sites preview while Vercel uses the same application
 * code against the Postgres database provisioned by Neon.
 */
export class NeonD1Compat {
  constructor(private readonly pool: NeonClient) {}

  prepare(query: string): D1PreparedStatement {
    return new NeonPreparedStatement(this, query);
  }

  async execute(query: string, values: readonly unknown[], mode: QueryMode, client = this.pool): Promise<D1Result<unknown>> {
    const result = await client.query({
      text: replaceQuestionMarks(query),
      values: [...values],
      rowMode: mode === "arrays" ? "array" : "object",
    });

    return {
      results: result.rows,
      success: true,
      meta: resultMeta(result.rowCount),
    };
  }

  async batch(statements: readonly D1PreparedStatement[]): Promise<D1Result<unknown>[]> {
    const client = await this.pool.connect();
    try {
      await client.query({ text: "BEGIN" });
      const results: D1Result<unknown>[] = [];
      for (const statement of statements) {
        const candidate = statement as unknown as NeonPreparedStatement;
        // Every statement used by the application originates from this
        // adapter, so execute through its bound query and parameter values.
        results.push(await this.execute(candidate.query, candidate.boundValues, "objects", client));
      }
      await client.query({ text: "COMMIT" });
      return results;
    } catch (error) {
      await client.query({ text: "ROLLBACK" }).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const result = await this.execute(query, [], "objects");
    return { count: result.meta.changes, duration: 0 };
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("D1 dump is not available for Neon Postgres.");
  }
}

export async function createNeonD1Compat(connectionString: string): Promise<NeonD1Compat> {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new NeonD1Compat(pool as unknown as NeonClient);
}
