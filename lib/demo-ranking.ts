import {demoOffers,type Offer} from "./offers";
import {historySummary} from "./ranking";
export function demoRanking():Offer[] {
  const now=Date.now();
  const shopee:Offer[]=demoOffers.slice(0,3).map((o,i)=>({...o,id:`demo-shopee-${i}`,title:["Fone Bluetooth compacto com estojo de carregamento","Cafeteira elétrica programável com jarra de vidro","Relógio inteligente com pulseira de silicone"][i],marketplace:"shopee",price:[79.90,159.90,99.90][i],originalPrice:[129.90,229.90,159.90][i],url:`https://shopee.com.br/search?keyword=${encodeURIComponent(["fone bluetooth","cafeteira","smartwatch"][i])}`,freeShipping:false}));
  return [...demoOffers,...shopee].map((offer,i)=>{
    const historical=offer.price*(1.12+(i%4)*.07);
    const rows=Array.from({length:14},(_,d)=>({observed_at:now-(d+1)*86400000,price_cents:Math.round((historical+(d%3-1)*7)*100)}));
    return {...offer,history:historySummary(rows,offer.price*.9,now),seller:{id:`demo-seller-${i}`,name:["Loja Exemplo Oficial","Casa Exemplo","Tech Exemplo"][i%3],profile:offer.marketplace==="shopee"?"https://shopee.com.br/":"https://www.mercadolivre.com.br/",trust:i===5?"low":i===2?"medium":"high",reasons:["Perfil fictício para demonstrar a avaliação do vendedor."],source:"demo",checkedAt:new Date().toISOString(),rating:4.9,reviews:1200},score:90-i*3} as Offer;
  }).sort((a,b)=>(b.history?.discount||0)-(a.history?.discount||0));
}
