import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../outputs/offers-test.mjs';
// Small bundles resolve the same TypeScript imports used by the application.
import {historySummary,classifyMercado,classifyShopee,rankOffers} from '../outputs/ranking-test.mjs';
const now=Date.parse('2026-11-27T15:00:00Z');
const offer={id:'MLB1',title:'Teste',marketplace:'mercado',price:200,category:'X',freeShipping:true,shipping:0,url:'https://example.com',checkedAt:new Date(now).toISOString()};
const coupon={id:'c',code:'TESTE',marketplace:'mercado',type:'percent',value:20,min:100,cap:30,category:'X',expires:'2026-12-01T00:00:00Z',verified:true,source:'https://www.mercadolivre.com.br/cupons',restrictions:'Teste'};
test('cupom respeita teto, compra mínima, validade, loja, produto e plataforma',()=>{
  assert.equal(estimate(offer,[coupon],now).total,170);
  for(const change of [{min:300},{expires:'2026-11-26'},{marketplace:'shopee'},{shopId:'99'},{itemId:'other'},{verified:false}])assert.equal(estimate(offer,[{...coupon,...change}],now).discount,0);
  assert.equal(estimate({...offer,demo:true},[coupon],now).discount,0);
});
test('cupons não acumulam e desconto nunca deixa preço negativo',()=>{
  const fixed={...coupon,id:'fixed',type:'fixed',value:500};
  assert.equal(estimate(offer,[coupon,fixed],now).total,0);
  assert.equal(estimate({...offer,freeShipping:false,shipping:undefined},[],now).shippingKnown,false);
});
test('referência é mediana diária, exclui hoje e exige sete dias distintos',()=>{
  const rows=Array.from({length:7},(_,i)=>({observed_at:now-(i+1)*86400000,price_cents:10000}));
  rows.push({observed_at:now-1000,price_cents:1000000});
  const result=historySummary(rows,80,now);
  assert.equal(result.sufficient,true);assert.equal(result.median,100);assert.equal(result.discount,20);
  assert.equal(historySummary(Array.from({length:100},(_,i)=>({observed_at:now-86400000-i*1000,price_cents:10000})),80,now).sufficient,false);
});
test('Mercado Livre exige evidência suficiente para alta confiança',()=>{
  assert.equal(classifyMercado({seller_reputation:{level_id:'5_green',transactions:{completed:200,ratings:{positive:.99}}}}).trust,'high');
  assert.equal(classifyMercado({seller_reputation:{level_id:'5_green',transactions:{completed:2,ratings:{positive:1}}}}).trust,'medium');
  assert.equal(classifyMercado({seller_reputation:{level_id:'1_red'}}).trust,'low');
  assert.equal(classifyMercado({}).trust,'unknown');
});
test('Shopee não usa nota de produto ou selo isolado como reputação da loja',()=>{
  const shop={id:'1',name:'Loja',profile:'https://shopee.com.br/shop/1'};
  assert.equal(classifyShopee({...shop,badge:'Oficial'}).trust,'unknown');
  assert.equal(classifyShopee({...shop,rating:4.9,reviews:300}).trust,'high');
  assert.equal(classifyShopee({...shop,rating:3.2,reviews:300}).trust,'low');
  assert.equal(classifyShopee({...shop,rating:5,reviews:2}).trust,'unknown');
});
test('ranking limita a 100, penaliza baixa confiança e exclui aumentos comprovados',()=>{
  const history={sufficient:true,discount:20,days:8,samples:8,points:[]};
  const high={...offer,id:'high',seller:{trust:'high'},history};
  const low={...offer,id:'low',seller:{trust:'low'},history};
  const increased={...offer,id:'up',history:{...history,discount:-10}};
  const result=rankOffers([low,increased,high],[]);assert.equal(result[0].id,'high');assert.equal(result.length,2);
  assert.equal(rankOffers(Array.from({length:110},(_,i)=>({...high,id:String(i)})),[]).length,100);
});
