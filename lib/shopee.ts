import type {Offer} from "./offers";
import { classifyShopee } from "./ranking";
type Env=Record<string,string|undefined>;
export async function shopeeQuery(query:string,env:Env) {
  if(!env.SHOPEE_APP_ID||!env.SHOPEE_SECRET)throw new Error("Shopee: acesso à Open API pendente. Solicite a liberação no portal de afiliados e configure SHOPEE_APP_ID e SHOPEE_SECRET.");
  const body=JSON.stringify({query}),timestamp=Math.floor(Date.now()/1000).toString();
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.SHOPEE_APP_ID+timestamp+body+env.SHOPEE_SECRET));
  const signature=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,"0")).join("");
  const response=await fetch("https://open-api.affiliate.shopee.com.br/graphql",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`SHA256 Credential=${env.SHOPEE_APP_ID}, Timestamp=${timestamp}, Signature=${signature}`},body,signal:AbortSignal.timeout(20000)});
  const data:any=await response.json();
  if(!response.ok||data.errors?.length)throw new Error(`Shopee: consulta não autorizada ou incompatível com o acesso da conta (${data.errors?.[0]?.extensions?.code||response.status}). Confira o contrato no Open API Explorer.`);
  return data.data;
}
export async function shopeeOffers(query:string,env:Env,page=1,itemId?:string) {
  const args=`${itemId?`itemId:${itemId}`:`keyword:${JSON.stringify(query)}`},page:${page},limit:50,sortType:2`;
  const data=await shopeeQuery(`{ productOfferV2(${args}) { nodes { itemId shopId shopName productName priceMin priceMax imageUrl productLink offerLink productCatIds ratingStar priceDiscountRate shopType } pageInfo { page limit hasNextPage } } }`,env);
  const offers:Offer[]=(data.productOfferV2?.nodes||[]).flatMap((p:any)=>{
    const price=Number(p.priceMin);if(!Number.isFinite(price)||price<=0)return [];
    const shop=String(p.shopId),id=String(p.itemId);
    return [{id:`${shop}-${id}`,marketplace:"shopee",sellerId:shop,title:p.productName,price,priceMax:Number(p.priceMax)||undefined,category:String(p.productCatIds?.[0]||"Sem categoria"),url:p.productLink||`https://shopee.com.br/product/${shop}/${id}`,affiliate:p.offerLink||undefined,image:p.imageUrl,freeShipping:false,checkedAt:new Date().toISOString(),listingDiscount:Number(p.priceDiscountRate)||undefined,seller:classifyShopee({id:shop,name:p.shopName||shop,profile:`https://shopee.com.br/shop/${shop}`,badge:Array.isArray(p.shopType)?p.shopType.join(", "):undefined})}];
  });
  return {offers,hasNextPage:!!data.productOfferV2?.pageInfo?.hasNextPage};
}
export async function shopeeOffer(id:string,env:Env) {
  const m=id.match(/^(\d+)-(\d+)$/);if(!m)throw new Error("Código de produto Shopee inválido.");
  const result=await shopeeOffers("",env,1,m[2]);
  const offer=result.offers.find(o=>o.id===id);if(!offer)throw new Error("Produto não encontrado nas ofertas da API de afiliados Shopee.");return offer;
}
