import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCoupon,couponMaximum,estimate,rankCoupons} from '../outputs/offers-test.mjs';
import {couponShareText,productShareText,whatsappShareUrl} from '../outputs/sharing-test.mjs';

const now=Date.parse('2026-11-27T15:00:00Z');
const base={id:'large',code:'ECONOMIZE20',marketplace:'mercado',type:'percent',value:20,min:10,cap:1000,category:'Todas',expires:'2026-12-01T02:59:59Z',source:'https://www.mercadolivre.com.br/cupons',restrictions:'Produtos selecionados. Verifique sua conta.',verified:true};
const small={...base,id:'small',code:'CINQUENTA',value:50,cap:5};
const product={id:'MLB123',title:'Café & açúcar + caneca — promoção de 20%',marketplace:'mercado',price:100,category:'Casa',sellerId:'456',url:'https://produto.mercadolivre.com.br/MLB-123',freeShipping:false,checkedAt:new Date(now).toISOString()};
const mlLink='https://meli.la/exemplo?ref=promo%2B2026&canal=whatsapp';
const shopeeLink='https://s.shopee.com.br/exemplo?utm_source=canal&ref=promo%2B2026';

test('catálogo prioriza R$ 1000 de potencial acima de 50% limitado a R$ 5',()=>{
  assert.equal(couponMaximum(base),1000);
  assert.equal(couponMaximum(small),5);
  const input=[small,base];
  assert.deepEqual(rankCoupons(input,now).map(c=>c.id),['large','small']);
  assert.equal(input[0].id,'small','A classificação não modifica a lista original');
  assert.equal(checkCoupon(base,now).spendToMax,5000);
  assert.equal(checkCoupon({...base,min:6000},now).spendToMax,6000);
});

test('produto usa a economia efetiva, mesmo quando o catálogo destaca outro cupom',()=>{
  const low=estimate({...product,price:20},[base,small],now);
  assert.equal(low.coupon.id,'small');assert.equal(low.discount,5);assert.equal(low.total,15);
  const high=estimate({...product,price:1000},[small,base],now);
  assert.equal(high.coupon.id,'large');assert.equal(high.discount,200);assert.equal(high.total,800);
  assert.equal(estimate({...product,price:9000},[base],now).discount,1000,'O percentual respeita o teto');
});

test('teto ausente é incompleto e não entra na estimativa; fixos usam apenas seu valor',()=>{
  for(const cap of [0,undefined,NaN,-5]){
    const unknown={...base,cap};
    assert.equal(couponMaximum(unknown),null);
    assert.equal(checkCoupon(unknown,now).status,'incomplete');
    assert.equal(estimate(product,[unknown],now).discount,0);
  }
  const fixed={...base,id:'fixed',type:'fixed',value:50,cap:1000};
  assert.equal(couponMaximum(fixed),50);
  assert.equal(checkCoupon(fixed,now).spendToMax,50);
  assert.equal(estimate(product,[fixed],now).discount,50);
  assert.equal(estimate({...product,price:20},[fixed],now).total,0,'Desconto fixo não deixa valor negativo');
});

test('validade, conferência e fonte oficial controlam classificação e compartilhamento',()=>{
  const expired={...base,id:'expired',cap:100000,expires:new Date(now).toISOString()};
  const review={...base,id:'review',verified:false};
  const incomplete={...base,id:'incomplete',source:'https://site-externo.example/cupons'};
  assert.equal(checkCoupon(expired,now).status,'expired');
  assert.equal(checkCoupon(review,now).status,'review');
  assert.equal(checkCoupon(incomplete,now).status,'incomplete');
  assert.equal(rankCoupons([expired,review,incomplete,small],now)[0].id,'small');
  for(const coupon of [expired,review,incomplete,{...base,expires:'não é uma data'},{...base,value:101},{...base,min:-1},{...base,restrictions:''}]){
    assert.equal(checkCoupon(coupon,now).ready,false);
    assert.throws(()=>couponShareText(coupon,mlLink,now));
  }
});

test('cupom compartilhado informa teto, mínimo, compra para atingir teto, validade e publicidade',()=>{
  const text=couponShareText(base,mlLink,now);
  for(const snippet of ['ECONOMIZE20','Mercado Livre','20%','1.000,00','Compra mínima:','10,00','5.000,00','30/11/2026','Brasília','Produtos selecionados','Confirme no carrinho','Publicidade','comissão',mlLink])assert.ok(text.includes(snippet),snippet);
  const fixed=couponShareText({...base,type:'fixed',value:50,cap:1000},mlLink,now);
  assert.ok(fixed.includes('50,00 de desconto'));
  assert.ok(!fixed.includes('1.000,00'),'O teto herdado não é divulgado como benefício de um cupom fixo');
});

test('compartilhamento exige HTTPS de domínio oficial correspondente à plataforma',()=>{
  for(const link of ['','http://meli.la/exemplo','javascript:alert(1)','https://meli.la.evil.example/exemplo','https://usuario:senha@meli.la/exemplo','https://meli.la:8443/exemplo',shopeeLink]){
    assert.throws(()=>couponShareText(base,link,now),link);
    assert.throws(()=>productShareText(product,undefined,link,now),link);
  }
  const shopCoupon={...base,marketplace:'shopee',source:'https://shopee.com.br/cupons'};
  assert.ok(couponShareText(shopCoupon,shopeeLink,now).includes(shopeeLink));
  assert.throws(()=>couponShareText(shopCoupon,mlLink,now));
});

test('WhatsApp preserva UTF-8 e o link completo sem acionar envio',()=>{
  const text=productShareText(product,base,mlLink,now);
  assert.ok(text.includes(product.title));assert.ok(text.includes(mlLink));assert.ok(text.includes('Publicidade'));
  const url=new URL(whatsappShareUrl(text));
  assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/');
  assert.equal(url.searchParams.get('text'),text);
  assert.deepEqual([...url.searchParams.keys()],['text']);
  assert.equal(productShareText(product,{...base,expires:'2026-01-01'},mlLink,now).includes('Cupom ECONOMIZE20'),false);
  assert.match(couponShareText({...base,demo:true,source:'Demonstração'},mlLink,now),/^\[DEMONSTRAÇÃO/);
});

test('produto compartilha apenas cupom compatível com suas condições',()=>{
  for(const change of [{marketplace:'shopee',source:'https://shopee.com.br/cupons'},{min:200},{shopId:'outro-vendedor'},{itemId:'outro-produto'},{category:'Eletrônicos'},{demo:true}]){
    const text=productShareText(product,{...base,...change},mlLink,now);
    assert.ok(!text.includes('Cupom ECONOMIZE20'),JSON.stringify(change));
  }
});

test('produto informa teto, mínimo e validade do cupom selecionado',()=>{
  const text=productShareText(product,base,mlLink,now);
  for(const snippet of ['20%','1.000,00','Compra mínima:','10,00','30/11/2026','Brasília','Confirme no carrinho'])assert.ok(text.includes(snippet),snippet);
});
