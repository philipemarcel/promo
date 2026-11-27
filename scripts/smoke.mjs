import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Local API tests only. This script never opens WhatsApp or calls /api/publish.
const base='http://127.0.0.1:5173';
assert.equal((await fetch(`${base}/api/bootstrap`)).status,401,'Anonymous access is rejected');
const login=await fetch(`${base}/signin-with-chatgpt?return_to=/`,{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
assert.ok(cookie,'Local mock sign-in returns a cookie');

async function request(path,body){
  const response=await fetch(`${base}/api/${path}`,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json()};
}
async function api(path,body){const result=await request(path,body);if(result.status>=400)throw new Error(result.data.error);return result.data;}

const created=[];
const nonce=randomUUID().slice(0,8).toUpperCase();
const affiliate='https://s.shopee.com.br/qa-exemplo?canal=whatsapp&sub_id=integracao';
const updatedAffiliate='https://shope.ee/qa-segundo?canal=whatsapp&sub_id=integracao';
const couponBase={type:'percent',value:20,min:10,cap:1000,marketplace:'shopee',category:'Todas',expires:new Date(Date.now()+86400000).toISOString(),source:'https://shopee.com.br/',restrictions:'TESTE LOCAL. Não é um cupom válido.',verified:true,affiliate};

try {
  const before=await api('bootstrap');
  const initialIds=new Set(before.coupons.map(c=>c.id));
  const large=await api('coupon',{...couponBase,code:`QA-${nonce}-20`});created.push(['coupon',large.id]);
  const small=await api('coupon',{...couponBase,code:`QA-${nonce}-50`,value:50,cap:5});created.push(['coupon',small.id]);
  const review=await api('coupon',{...couponBase,code:`QA-${nonce}-REVIEW`,verified:false,cap:10000});created.push(['coupon',review.id]);
  assert.equal(large.affiliate,affiliate);
  assert.ok(!initialIds.has(large.id)&&!initialIds.has(small.id)&&!initialIds.has(review.id));

  const sorted=(await api('bootstrap')).coupons;
  assert.ok(sorted.findIndex(c=>c.id===large.id)<sorted.findIndex(c=>c.id===small.id),'20% capped at R$ 1000 precedes 50% capped at R$ 5');
  assert.ok(sorted.findIndex(c=>c.id===small.id)<sorted.findIndex(c=>c.id===review.id),'Unreviewed high caps do not outrank checked coupons');

  const check=await api('coupon-check',{id:review.id});
  assert.equal(check.checks[0].status,'review');assert.equal(check.checks[0].ready,false);
  const checked=(await api('bootstrap')).coupons.find(c=>c.id===review.id);
  assert.equal(checked.verified,false,'Checking rules does not mark a coupon manually verified');
  assert.equal(checked.checkedAt,check.checks[0].checkedAt);
  assert.ok(Date.parse(checked.checkedAt)>=Date.parse(review.checkedAt));
  assert.equal((await api('coupon-check',{id:large.id})).checks[0].status,'ready');

  const changed=await api('coupon-link',{id:large.id,affiliate:updatedAffiliate});
  assert.equal(changed.id,large.id);assert.equal(changed.affiliate,updatedAffiliate);
  assert.equal((await request('coupon-link',{id:large.id,affiliate:'https://meli.la/qa'})).status,400,'Reject a Mercado Livre link on a Shopee coupon');
  assert.equal((await api('bootstrap')).coupons.find(c=>c.id===large.id).affiliate,updatedAffiliate,'Rejected links do not overwrite the saved attribution');

  const edited=await api('coupon',{...changed,value:19,cap:800});
  assert.equal(edited.id,large.id);assert.equal(edited.affiliate,updatedAffiliate);
  const afterEdit=(await api('bootstrap')).coupons;
  assert.equal(afterEdit.filter(c=>c.id===large.id).length,1,'Editing does not duplicate the coupon');
  assert.equal(afterEdit.find(c=>c.id===large.id).cap,800);

  const offer={id:`qa-demo-${nonce}`,marketplace:'shopee',title:'TESTE LOCAL — produto de demonstração',price:100,category:'Teste',url:'https://shopee.com.br/',freeShipping:false,demo:true,checkedAt:new Date().toISOString()};
  const watch=await api('watch',{offer,target:80,affiliate});created.push(['watch',watch.id]);
  const draft=await api('queue',{offer,channel:'whatsapp',affiliate});created.push(['post',draft.id]);
  assert.ok(draft.caption.includes(affiliate));assert.ok(draft.caption.includes('Publicidade'));assert.ok(draft.caption.includes('DEMONSTRAÇÃO'));
  const after=await api('bootstrap');assert.ok(after.watches.find(w=>w.id===watch.id));assert.ok(after.posts.find(p=>p.id===draft.id));
  console.log('PASS: auth, maximum-discount order, affiliate platform validation, rule checks, link persistence, coupon editing, watch and WhatsApp draft. No messages sent.');
} finally {
  // Only IDs returned by this run are removed. No shared records or source data are changed.
  const results=await Promise.allSettled(created.map(([kind,id])=>api(kind==='post'?'queue':kind,{id,delete:true})));
  for(const result of results)if(result.status==='rejected')console.error('A local QA fixture could not be removed:',result.reason.message);
}
