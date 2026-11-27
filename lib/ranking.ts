import { estimate, type Offer, type Coupon, type Seller } from "./offers";
export const trustLabels={high:"Alta confiabilidade",medium:"Confiabilidade moderada",low:"Baixa confiabilidade",unknown:"Reputação não verificada"};
export function classifyMercado(profile:any):Seller {
  const r=profile.seller_reputation||{},tx=r.transactions||{};
  const level=r.real_level||r.level_id||"",completed=Number(tx.completed)||0,positive=tx.ratings?.positive;
  const negative=tx.ratings?.negative;
  let trust:Seller["trust"]="unknown";
  const reasons:string[]=[];
  if(level){reasons.push(`Termômetro do Mercado Livre: ${level}.`);trust="medium";}
  if(["1_red","2_orange","red","orange"].includes(level))trust="low";
  if(["5_green","4_light_green","green","light_green"].includes(level)&&completed>=100&&typeof positive==="number"&&positive>=.95)trust="high";
  if(completed>=30&&typeof negative==="number"&&negative>=.1)trust="low";
  if(completed)reasons.push(`${completed} transações concluídas no período informado.`);
  if(typeof positive==="number")reasons.push(`${(positive*100).toFixed(1)}% de avaliações positivas.`);
  if(!level)reasons.push("Perfil sem termômetro de reputação disponível.");
  return {id:String(profile.id),name:profile.nickname||String(profile.id),profile:(profile.permalink||`https://www.mercadolivre.com.br/perfil/${profile.nickname||profile.id}`).replace(/^http:/,"https:"),trust,reasons,checkedAt:new Date().toISOString(),source:"api",level,completed,positive,badge:r.power_seller_status||undefined};
}
export function classifyShopee(input:{id:string;name:string;profile:string;rating?:number;reviews?:number;source?:"manual"|"api";badge?:string}):Seller {
  const rating=input.rating,reviews=input.reviews;
  let trust:Seller["trust"]="unknown";
  const reasons:string[]=[];
  if(rating!==undefined&&reviews!==undefined&&reviews>=30){trust=rating<=3.5?"low":rating>=4.7&&reviews>=100?"high":"medium";reasons.push(`Loja: ${rating.toFixed(1)}/5 em ${reviews} avaliações.`);}
  else reasons.push("A fonte não forneceu avaliação e volume suficientes do perfil da loja. Nota do produto não é nota do vendedor.");
  if(input.badge)reasons.push(`Selo informado pela plataforma: ${input.badge}.`);
  return {...input,trust,reasons,checkedAt:new Date().toISOString(),source:input.source||"api"};
}
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function historySummary(rows:{observed_at:number;price_cents:number}[],effectivePrice:number,now=Date.now()) {
  const day=(n:number)=>new Date(n-3*3600000).toISOString().slice(0,10);
  const daily=new Map<string,number[]>();
  for(const r of rows){if(r.observed_at>=now||r.observed_at<now-90*86400000)continue;const d=day(r.observed_at);if(d===day(now))continue;daily.set(d,[...(daily.get(d)||[]),r.price_cents/100]);}
  const points=[...daily].map(([date,p])=>({date,price:Math.round(median(p)*100)/100})).sort((a,b)=>a.date.localeCompare(b.date));
  const baseline=points.length?median(points.map(p=>p.price)):undefined;
  const sufficient=points.length>=7;
  return {days:points.length,samples:rows.length,median:baseline,lowest:rows.length?Math.min(...rows.map(r=>r.price_cents/100)):undefined,first:rows.length?new Date(Math.min(...rows.map(r=>r.observed_at))).toISOString():undefined,discount:baseline?Math.round((1-effectivePrice/baseline)*10000)/100:undefined,sufficient,points};
}
export function rankOffers(offers:Offer[],coupons:Coupon[]) {
  const trustPoints={high:12,medium:4,unknown:0,low:-25};
  return offers.filter(offer=>offer.history?.sufficient?(offer.history.discount||0)>0:estimate(offer,coupons).discount>0||(offer.originalPrice||0)>offer.price||(offer.listingDiscount||0)>0).map(offer=>{const result=estimate(offer,coupons),discount=offer.history?.sufficient?offer.history.discount||0:0;return {...offer,score:Math.round((Math.max(-50,Math.min(80,discount))*.85+trustPoints[offer.seller?.trust||"unknown"]+(result.discount/offer.price)*10+(offer.freeShipping?2:0))*100)/100};}).sort((a,b)=>Number(!!b.history?.sufficient)-Number(!!a.history?.sufficient)||(b.score||0)-(a.score||0)||a.price-b.price).slice(0,100);
}
