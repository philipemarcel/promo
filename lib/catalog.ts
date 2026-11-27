import { ml,searchOffers,getOffer } from "./mercado";
import { shopeeOffers,shopeeOffer } from "./shopee";
import { type Offer,type Coupon,offerKey,estimate } from "./offers";
import { classifyMercado,historySummary,rankOffers } from "./ranking";
import {database,get,put,list,remove} from "./storage";
type Env=Record<string,string|undefined>;
export async function hydrate(offers:Offer[],coupons:Coupon[],env:Env,checkSellers=true) {
  const result:Offer[]=[];
  // Small batches limit upstream requests; seller results are cached independently of prices.
  for(let offset=0;offset<offers.length;offset+=5) {
    const batch=await Promise.all(offers.slice(offset,offset+5).map(async offer=>{
      let seller=offer.seller;
      if(checkSellers&&offer.sellerId) {
        const key=`seller-${offer.marketplace||"mercado"}-${offer.sellerId}`,cache=await get(key,"seller");
        if(cache&&Date.now()-Date.parse(cache.checkedAt)<6*3600000)seller=cache;
        else if(offer.marketplace!=="shopee") {
          try {seller=classifyMercado(await ml(`/users/${offer.sellerId}`,env));await put("seller",seller,key);}catch{seller={id:offer.sellerId,name:offer.sellerId,profile:`https://www.mercadolivre.com.br/perfil/${offer.sellerId}`,trust:"unknown",source:"api",checkedAt:new Date().toISOString(),reasons:["Não foi possível consultar a reputação oficial deste vendedor."]};}
        }
      }
      const key=offerKey(offer),now=Date.now();
      await database().prepare("INSERT OR IGNORE INTO price_history(id,offer_key,price_cents,observed_at,source) VALUES(?,?,?,?,?)").bind(`${key}-${Math.floor(now/3600000)}`,key,Math.round(offer.price*100),now,offer.manual?"manual":"api").run();
      const rows=await database().prepare("SELECT observed_at,price_cents FROM price_history WHERE offer_key=? AND observed_at>? ORDER BY observed_at DESC LIMIT 2160").bind(key,now-90*86400000).all<{observed_at:number;price_cents:number}>();
      const enriched={...offer,seller,history:historySummary(rows.results,estimate(offer,coupons).total,now)};
      await put("offer",enriched,`offer-${key}`);
      return enriched;
    }));result.push(...batch);
  }
  return result;
}
export async function currentOffer(id:string,marketplace:string|undefined,env:Env) {
  if(marketplace==="shopee"&&!env.SHOPEE_APP_ID){const cached=await get(`offer-shopee:${id}`,"offer");if(cached?.manual)return cached;}
  return marketplace==="shopee"?shopeeOffer(id,env):getOffer(id,env);
}
export async function combinedSearch(query:string,source:string,env:Env,coupons:Coupon[]) {
  const providers:{name:string;run:()=>Promise<Offer[]>}[]=[];
  if(source!=="shopee")providers.push({name:"Mercado Livre",run:()=>searchOffers(query,env)});
  if(source!=="mercado")providers.push({name:"Shopee",run:async()=>(await shopeeOffers(query,env)).offers});
  const responses=await Promise.allSettled(providers.map(p=>p.run()));
  let offers:Offer[]=[];const errors:string[]=[];
  responses.forEach((r,i)=>{if(r.status==="fulfilled")offers.push(...r.value);else errors.push(`${providers[i].name}: ${r.reason.message}`);});
  offers=await hydrate(offers,coupons,env);
  return {offers,errors};
}
export async function topOffers(coupons:Coupon[]) {
  const saved=(await list("offer")).filter(o=>Date.now()-Date.parse(o.checkedAt)<24*3600000);
  // Recompute coupon-sensitive history discounts on every read.
  const offers=saved.map(o=>{const price=estimate(o,coupons).total;return {...o,history:o.history?{...o.history,discount:o.history.median?Math.round((1-price/o.history.median)*10000)/100:undefined}:undefined};});
  return rankOffers(offers,coupons);
}
export async function scanCatalog(env:Env) {
  const started=Date.now(),id="scan-lock";
  const latest=await get("latest-scan","scan");
  if(latest&&Date.now()-Date.parse(latest.checkedAt)<60000)return {...latest,offers:await topOffers(await list("coupon") as Coupon[])};
  const lock=await database().prepare("INSERT INTO records(id,kind,data,created_at) VALUES(?,'lock',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(records.data,'$.expires') < ? RETURNING id").bind(id,JSON.stringify({expires:started+300000}),new Date().toISOString(),started).first();
  if(!lock)throw new Error("Uma coleta de ofertas já está em andamento.");
  try {
    const coupons=await list("coupon") as Coupon[],settings=await get("settings","settings");
    const queries:string[]=(settings?.queries||["fone bluetooth","cafeteira","smartwatch","mouse gamer","air fryer","notebook"]).slice(0,12);
    const errors:string[]=[],found=new Map<string,Offer>();
    for(const query of queries) {
      if(env.ML_ACCESS_TOKEN){try{for(const o of await searchOffers(query,env))found.set(offerKey(o),o);}catch(e:any){errors.push(`Mercado Livre: ${e.message}`);break;}}
    }
    if(env.SHOPEE_APP_ID&&env.SHOPEE_SECRET){for(let page=1;page<=3;page++){try{const r=await shopeeOffers("",env,page);for(const o of r.offers)found.set(offerKey(o),o);if(!r.hasNextPage)break;}catch(e:any){errors.push(e.message);break;}}}
    if(!env.ML_ACCESS_TOKEN)errors.push("Mercado Livre: credenciais pendentes.");
    if(!env.SHOPEE_APP_ID||!env.SHOPEE_SECRET)errors.push("Shopee: liberação da API e credenciais pendentes.");
    const offers=await hydrate([...found.values()].slice(0,300),coupons,env);
    const meta={checkedAt:new Date().toISOString(),count:offers.length,errors:[...new Set(errors)],duration:Date.now()-started};
    await put("scan",meta,"latest-scan");await put("event",{type:"scan",message:`Coleta do Top 100: ${offers.length} ofertas consultadas. ${meta.errors.length} avisos.`,errors:meta.errors});
    // Bound historical storage to the documented 90-day window.
    await database().prepare("DELETE FROM price_history WHERE observed_at < ?").bind(Date.now()-90*86400000).run();
    return {...meta,offers:await topOffers(coupons)};
  }finally{await remove("lock",id);}
}
