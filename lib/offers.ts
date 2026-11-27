import { affiliateUrl } from "./affiliate";
export type Marketplace = "mercado" | "shopee";
export type Seller = { id:string; name:string; profile:string; trust:"high"|"medium"|"low"|"unknown"; reasons:string[]; checkedAt:string; source:"api"|"manual"|"demo"; level?:string; rating?:number; reviews?:number; completed?:number; positive?:number; badge?:string };
export type HistorySummary = { days:number; samples:number; median?:number; lowest?:number; first?:string; discount?:number; sufficient:boolean; points:{date:string;price:number}[] };
export type Offer = { id: string; title: string; price: number; originalPrice?: number; image?: string; url: string; category: string; freeShipping: boolean; shipping?: number; demo?: boolean; type?: string; checkedAt: string; marketplace?:Marketplace; sellerId?:string; seller?:Seller; history?:HistorySummary; score?:number; affiliate?:string; manual?:boolean; priceMax?:number; listingDiscount?:number };
export type Coupon = { id: string; code: string; type: "percent" | "fixed"; value: number; min: number; cap: number; category: string; expires: string; source: string; restrictions: string; verified: boolean; demo?: boolean; marketplace?:Marketplace; shopId?:string; itemId?:string; affiliate?:string; checkedAt?:string };
export const marketName = (o: {marketplace?:Marketplace}) => o.marketplace==="shopee"?"Shopee":"Mercado Livre";
export const offerKey = (o:Offer) => `${o.marketplace||"mercado"}:${o.id}`;
export function couponMaximum(c:Coupon):number|null {
  const maximum=c.type==="fixed"?c.value:c.cap;
  return Number.isFinite(maximum)&&maximum>0?Math.round(maximum*100)/100:null;
}
export function checkCoupon(c:Coupon,now=Date.now()) {
  const issues:string[]=[];
  const expiry=Date.parse(c.expires),expired=Number.isFinite(expiry)&&expiry<=now;
  if(!Number.isFinite(expiry))issues.push("Validade não informada ou inválida.");
  if(expired)issues.push("Prazo de validade encerrado.");
  if(!c.verified)issues.push("As regras ainda não foram conferidas na fonte.");
  if(!Number.isFinite(c.value)||c.value<=0||(c.type==="percent"&&c.value>100)||!["percent","fixed"].includes(c.type))issues.push("Desconto inválido.");
  if(!Number.isFinite(c.min)||c.min<0)issues.push("Compra mínima inválida.");
  if(c.type==="percent"&&couponMaximum(c)===null)issues.push("Teto do desconto não informado. Confira as regras da campanha.");
  if(!c.restrictions?.trim())issues.push("Condições da campanha não informadas.");
  if(!c.demo){try{affiliateUrl(c.source,c.marketplace||"mercado");}catch{issues.push("Fonte oficial da plataforma não informada.");}}
  const status=expired?"expired":!c.verified?"review":issues.length?"incomplete":"ready";
  const maximum=couponMaximum(c);
  const spendToMax=maximum===null?null:Math.max(c.min,c.type==="percent"?Math.ceil(maximum*10000/c.value)/100:maximum);
  return {status,ready:status==="ready",maximum,spendToMax,issues,checkedAt:new Date(now).toISOString()};
}
export function rankCoupons(coupons:Coupon[],now=Date.now()) {
  const tiers:Record<string,number>={ready:0,incomplete:1,review:2,expired:3};
  return [...coupons].sort((a,b)=>{
    const ca=checkCoupon(a,now),cb=checkCoupon(b,now);
    return tiers[ca.status]-tiers[cb.status]||(cb.maximum??-1)-(ca.maximum??-1)||(ca.spendToMax??Infinity)-(cb.spendToMax??Infinity)||a.code.localeCompare(b.code);
  });
}
export function estimate(offer: Offer, coupons: Coupon[], now = Date.now()) {
  const eligible = coupons.filter(c => checkCoupon(c,now).ready && (c.marketplace||"mercado")===(offer.marketplace||"mercado") && (!c.shopId||c.shopId===offer.sellerId) && (!c.itemId||c.itemId===offer.id) && !!c.demo === !!offer.demo && offer.price >= c.min && (c.category === "Todas" || c.category === offer.category));
  const savings = (c: Coupon) => Math.min(offer.price, c.type === "percent" ? Math.min(offer.price*c.value/100, c.cap || Infinity) : c.value);
  const best = eligible.sort((a,b)=>savings(b)-savings(a))[0];
  const discount = best ? Math.round(savings(best)*100)/100 : 0;
  return { coupon: best, discount, total: Math.round((offer.price-discount+(offer.shipping??0))*100)/100, shippingKnown: offer.freeShipping || offer.shipping !== undefined };
}
export const money = (v: number) => new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(v);
export function caption(offer: Offer, coupon?: Coupon, affiliate?: string) {
  return `${offer.demo ? "[DEMONSTRAÇÃO — valores fictícios]\n" : ""}${offer.title}\n${marketName(offer)} · ${money(offer.price)}${offer.priceMax&&offer.priceMax>offer.price?" a partir de · confirme a variação":""}${offer.freeShipping ? " · Frete grátis informado no anúncio" : " · Consulte o frete para seu CEP"}${coupon ? `\nCupom ${coupon.code}: ${coupon.type==="percent"?`${coupon.value}% de desconto, limitado a ${money(couponMaximum(coupon)||0)}`:`${money(coupon.value)} de desconto`}. Compra mínima: ${money(coupon.min)}. ${coupon.restrictions} Desconto sujeito às regras e à elegibilidade da sua conta. Confirme no carrinho.` : ""}\n${affiliate || offer.affiliate || offer.url}\nPreço e disponibilidade podem mudar.${affiliate||offer.affiliate ? "\nPublicidade · Link de afiliado: posso receber comissão." : ""}`;
}
const checkedAt = "2026-11-27T12:00:00Z";
export const demoOffers: Offer[] = [
  {id:"demo-fone",title:"Fone de ouvido sem fio com cancelamento de ruído",price:249.90,originalPrice:399.90,category:"Eletrônicos",type:"headphones",freeShipping:true,demo:true,url:"https://lista.mercadolivre.com.br/fone-bluetooth",checkedAt},
  {id:"demo-cafeteira",title:"Cafeteira elétrica espresso compacta 15 bar",price:429.90,originalPrice:599.90,category:"Casa e cozinha",type:"coffee",freeShipping:true,demo:true,url:"https://lista.mercadolivre.com.br/cafeteira-espresso",checkedAt},
  {id:"demo-relogio",title:"Smartwatch com monitor cardíaco e tela AMOLED",price:189.90,originalPrice:299.90,category:"Eletrônicos",type:"watch",freeShipping:false,demo:true,url:"https://lista.mercadolivre.com.br/smartwatch",checkedAt},
  {id:"demo-mouse",title:"Mouse gamer sem fio com sensor de alta precisão",price:159.90,originalPrice:229.90,category:"Informática",type:"mouse",freeShipping:true,demo:true,url:"https://lista.mercadolivre.com.br/mouse-gamer",checkedAt},
  {id:"demo-caixa",title:"Caixa de som portátil Bluetooth resistente à água",price:219.90,originalPrice:349.90,category:"Eletrônicos",type:"speaker",freeShipping:false,demo:true,url:"https://lista.mercadolivre.com.br/caixa-som-bluetooth",checkedAt},
  {id:"demo-panela",title:"Fritadeira sem óleo digital com capacidade de 4 litros",price:299.90,originalPrice:449.90,category:"Casa e cozinha",type:"airfryer",freeShipping:true,demo:true,url:"https://lista.mercadolivre.com.br/air-fryer",checkedAt},
];
export const demoCoupons: Coupon[] = ["mercado","shopee"].flatMap(marketplace=>[
  {id:`demo-coupon-${marketplace}`,marketplace:marketplace as Marketplace,code:"EXEMPLO20",type:"percent" as const,value:20,min:50,cap:1000,category:"Todas",expires:"2099-12-31T23:59:59Z",source:"Demonstração",restrictions:"Cupom fictício para testar o painel. Não usar em compras.",verified:true,demo:true},
  {id:`demo-small-${marketplace}`,marketplace:marketplace as Marketplace,code:"EXEMPLO50",type:"percent" as const,value:50,min:10,cap:5,category:"Todas",expires:"2099-12-31T23:59:59Z",source:"Demonstração",restrictions:"Cupom fictício para testar o teto de R$ 5. Não usar em compras.",verified:true,demo:true},
]);
