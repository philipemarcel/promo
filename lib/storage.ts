import { env } from "cloudflare:workers";
export function database() { if(!env.DB) throw new Error("Banco de dados indisponível."); return env.DB; }
export async function list(kind: string): Promise<any[]> {
  const rows=await database().prepare("SELECT id, data, created_at FROM records WHERE kind = ? ORDER BY created_at DESC").bind(kind).all<{id:string;data:string;created_at:string}>();
  return rows.results.map(r=>({...JSON.parse(r.data),...(kind==="offer"?{recordId:r.id}:{id:r.id}),createdAt:r.created_at}));
}
export async function get(id: string,kind: string) {
  const row=await database().prepare("SELECT data FROM records WHERE id = ? AND kind = ?").bind(id,kind).first<{data:string}>();
  return row?JSON.parse(row.data):null;
}
export async function put(kind: string,data: any,id:string=crypto.randomUUID()) {
  const record={...data,id:kind==="offer"||kind==="seller"?data.id:id};
  await database().prepare("INSERT INTO records(id,kind,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(id,kind,JSON.stringify(record),new Date().toISOString()).run(); return record;
}
export async function remove(kind:string,id:string) { await database().prepare("DELETE FROM records WHERE id = ? AND kind = ?").bind(id,kind).run(); }
