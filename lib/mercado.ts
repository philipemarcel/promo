import type { Offer } from "./offers";
type Env = Record<string, string | undefined>;
export async function ml(path: string, env: Env) {
  if (!env.ML_ACCESS_TOKEN) throw new Error("Configure ML_ACCESS_TOKEN para consultar ofertas reais do Mercado Livre.");
  const response = await fetch(`https://api.mercadolibre.com${path}`, {headers:{Authorization:`Bearer ${env.ML_ACCESS_TOKEN}`},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(response.status===403 ? "O Mercado Livre restringiu esta consulta (403). Verifique as permissões do aplicativo; não há resultados reais disponíveis." : response.status===401 ? "O token do Mercado Livre expirou ou é inválido. Atualize ML_ACCESS_TOKEN." : `Consulta ao Mercado Livre indisponível (${response.status}). Tente novamente mais tarde.`);
  return response.json();
}
export function normalize(item: any): Offer | null {
  if (!Number.isFinite(item.price) || item.price <= 0 || (item.currency_id && item.currency_id !== "BRL") || (item.status && item.status !== "active")) return null;
  const photo = item.pictures?.[0]?.secure_url || item.pictures?.[0]?.url || item.thumbnail;
  return {id:item.id,marketplace:"mercado",sellerId:String(item.seller_id||item.seller?.id||"")||undefined,title:item.title,price:item.price,originalPrice:item.original_price || undefined,image:photo?.replace(/^http:/,"https:"),url:item.permalink || `https://produto.mercadolivre.com.br/${item.id.replace(/^MLB/,"MLB-")}`,category:item.category_id || "Sem categoria",freeShipping:!!item.shipping?.free_shipping,shipping:item.shipping?.free_shipping ? 0 : undefined,checkedAt:new Date().toISOString()};
}
export async function searchOffers(query: string, env: Env) {
  const data:any = await ml(`/sites/MLB/search?q=${encodeURIComponent(query)}&sort=price_asc&limit=24`,env);
  return (data.results || []).map(normalize).filter(Boolean) as Offer[];
}
export async function getOffer(id: string, env: Env) {
  if (!/^MLB\d+$/.test(id)) throw new Error("Código de anúncio inválido. Use um anúncio MLB do Mercado Livre Brasil.");
  const offer=normalize(await ml(`/items/${id}`,env));
  if (!offer) throw new Error("Anúncio sem preço ativo em reais.");
  return offer;
}
