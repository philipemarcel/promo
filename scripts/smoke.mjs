import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
assert.equal((await fetch(`${base}/api/bootstrap`)).status,401,'Anonymous access is rejected');
const login=await fetch(`${base}/signin-with-chatgpt?return_to=/`,{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
assert.ok(cookie,'Local mock sign-in returns a cookie');
async function api(path,body){const r=await fetch(`${base}/api/${path}`,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
const ids=[];
try {
  const state=await api('bootstrap');assert.equal(state.connections.shopee,false);
  const coupon=await api('coupon',{code:'QA-INTEGRACAO',type:'percent',value:10,min:10,cap:20,marketplace:'shopee',shopId:'999999999991',itemId:'999999999991-999999999992',category:'Todas',expires:new Date(Date.now()+86400000).toISOString(),source:'https://shopee.com.br/',restrictions:'TESTE LOCAL. Não é um cupom válido.',verified:true});ids.push(['coupon',coupon.id]);
  const offer=await api('manual',{url:'https://shopee.com.br/product/999999999991/999999999992',title:'TESTE LOCAL — produto sintético',price:100,category:'Teste'});
  assert.equal(offer.id,'999999999991-999999999992');assert.equal(offer.manual,true);assert.equal(offer.seller.trust,'unknown');
  const seller=await api('seller',{id:'999999999991',name:'TESTE LOCAL',profile:'https://shopee.com.br/shop/999999999991',rating:4.9,reviews:200,confirmed:true});assert.equal(seller.trust,'high');
  const top=await api('top');const found=top.offers.find(o=>o.id===offer.id);assert.ok(found,'Persisted product ID survives storage and ranking');assert.equal(found.seller.trust,'high');
  const watch=await api('watch',{offer,target:80});ids.push(['watch',watch.id]);
  const draft=await api('queue',{offer,channel:'whatsapp'});ids.push(['post',draft.id]);assert.match(draft.caption,/Shopee/);assert.match(draft.caption,/QA-INTEGRACAO/);
  const blocked=await fetch(`${base}/api/publish`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({id:draft.id})});assert.equal(blocked.status,400);
  const after=await api('bootstrap');assert.ok(after.watches.find(w=>w.id===watch.id));assert.ok(after.posts.find(p=>p.id===draft.id));
  console.log('PASS: auth, coupon, manual Shopee offer, seller evidence, Top 100 storage, watch, queue and blocked manual publish.');
} finally {
  for(const [kind,id] of ids)await api(kind==='post'?'queue':kind,{id,delete:true});
}
