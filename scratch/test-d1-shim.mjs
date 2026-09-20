import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const testTable = sqliteTable("test_table", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

function createLocalD1(dbPath) {
  const sqlite = new DatabaseSync(dbPath);
  return {
    prepare(query) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params.map(p => (p instanceof Date ? Math.floor(p.getTime() / 1000) : p));
          return this;
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...boundParams);
          return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const result = stmt.run(...boundParams);
          return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
        },
        async first(col) {
          const stmt = sqlite.prepare(query);
          const row = stmt.get(...boundParams);
          if (!row) return null;
          return col ? row[col] : row;
        },
        async raw() {
          const stmt = sqlite.prepare(query);
          return stmt.all(...boundParams).map(r => Object.values(r));
        }
      };
    },
    async batch(statements) {
      return Promise.all(statements.map(s => s.all()));
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    }
  };
}

const localD1 = createLocalD1(":memory:");
localD1.exec("CREATE TABLE test_table (id text primary key, name text not null)");

const db = drizzle(localD1, { schema: { testTable } });
await db.insert(testTable).values({ id: "1", name: "Alice" });
const rows = await db.select().from(testTable);
console.log("Drizzle over Local D1 Shim Works! Rows:", rows);
