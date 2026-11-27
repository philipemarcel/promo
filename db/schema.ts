import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});
export const priceHistory = sqliteTable("price_history", {
  id: text("id").primaryKey(),
  offerKey: text("offer_key").notNull(),
  priceCents: integer("price_cents").notNull(),
  observedAt: integer("observed_at").notNull(),
  source: text("source").notNull(),
}, table => [index("prices_offer_time").on(table.offerKey,table.observedAt)]);
