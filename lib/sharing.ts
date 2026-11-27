import { affiliateUrl } from "./affiliate";
import {caption,checkCoupon,estimate,money,marketName,type Coupon,type Offer} from "./offers";

export function couponShareText(c:Coupon,link:string,now=Date.now()) {
  const check=checkCoupon(c,now);
  if(!check.ready)throw new Error("Confira a validade, o teto e as regras do cupom antes de compartilhar.");
  const url=affiliateUrl(link,c.marketplace||"mercado");
  return `${c.demo?"[DEMONSTRAÇÃO — cupom fictício]\n":""}Cupom ${c.code} · ${marketName(c)}\n${c.type==="percent"?`${c.value}% de desconto, limitado a ${money(check.maximum!)}`:`${money(c.value)} de desconto`}\nCompra mínima: ${money(c.min)}${c.type==="percent"?`\nPara atingir o teto: compra elegível de pelo menos ${money(check.spendToMax!)}`:""}\nValidade: ${new Date(c.expires).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})} (Brasília)\nCategoria: ${c.category}${c.shopId?` · Loja: ${c.shopId}`:""}${c.itemId?` · Produto: ${c.itemId}`:""}\n${c.restrictions}\n${url}\nSujeito à elegibilidade da conta e às regras da campanha. Confirme no carrinho.\nPublicidade · Link de afiliado: posso receber comissão.`;
}
export function productShareText(offer:Offer,coupon:Coupon|undefined,link:string,now=Date.now()) {
  const url=affiliateUrl(link,offer.marketplace||"mercado");
  const applicable=coupon?estimate(offer,[coupon],now).coupon:undefined;
  return caption(offer,applicable,url)+(applicable?`\nValidade do cupom: ${new Date(applicable.expires).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})} (Brasília).`:"");
}
export const whatsappShareUrl=(text:string)=>`https://wa.me/?text=${encodeURIComponent(text)}`;
