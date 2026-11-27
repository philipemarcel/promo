import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { list, get, put, remove, database } from "../../../lib/storage";
import { searchOffers, getOffer } from "../../../lib/mercado";
import { caption, estimate, demoCoupons, checkCoupon, rankCoupons, type Coupon, type Marketplace } from "../../../lib/offers";
import { affiliateUrl } from "../../../lib/affiliate";
import { publish } from "../../../lib/publisher";
import { combinedSearch,currentOffer,hydrate,scanCatalog,topOffers } from "../../../lib/catalog";
import { classifyShopee } from "../../../lib/ranking";

const runtime=()=>env as unknown as Record<string,string|undefined>;
const json=(data:any,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
function fail(message:string):never {throw new Error(message);}
function positive(value:any,max=10000000) { const n=Number(value); if(!Number.isFinite(n)||n<=0||n>max) fail("Informe um valor positivo válido."); return Math.round(n*100)/100; }
function validUrl(value:string) { const url=new URL(value); if(url.protocol!=="https:") fail("Use um link HTTPS."); return url.href; }
function affiliate(value:any,marketplace?:Marketplace) {return value?affiliateUrl(String(value),marketplace):"";}
async function auth(request:Request,action:string) {
  if(["monitor","scan"].includes(action) && runtime().MONITOR_SECRET && request.headers.get("Authorization")===`Bearer ${runtime().MONITOR_SECRET}`) return true;
  return !!(await getChatGPTUser());
}
async function runMonitor() {
  const now=Date.now();
  const lock=await database().prepare("INSERT INTO records(id,kind,data,created_at) VALUES('monitor-lock','lock',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(records.data,'$.expires') < ? RETURNING id").bind(JSON.stringify({expires:now+180000}),new Date().toISOString(),now).first();
  if(!lock) fail("Uma verificação já está em andamento. Aguarde alguns instantes.");
  let checked=0,alerts=0,errors=0;
  try {
    const coupons=await list("coupon") as Coupon[];
    const watches=(await list("watch")).filter(w=>w.enabled && !w.offer.demo && !w.offer.manual).slice(0,30);
    for(const watch of watches) {
      try {
        const offer=(await hydrate([await currentOffer(watch.offer.id,watch.offer.marketplace,runtime())],coupons,runtime()))[0];
        await put("watch",{...watch,offer,lastChecked:offer.checkedAt,error:null,history:[...(watch.history||[]),{time:offer.checkedAt,price:offer.price}].slice(-60)},watch.id);
        checked++;
        if(offer.price<=watch.target) {
          const coupon=estimate(offer,coupons).coupon;
          for(const channel of ["whatsapp","instagram","facebook"]) {
            const id=`auto-${watch.id}-${Math.round(offer.price*100)}-${channel}`;
            if(!await get(id,"post")) { await put("post",{offer,channel,affiliate:watch.affiliate||"",caption:caption(offer,coupon,watch.affiliate),imageUrl:watch.imageUrl||"",status:"draft",automatic:true},id); alerts++; }
          }
        }
      } catch(e:any) { errors++; await put("watch",{...watch,error:e.message,lastChecked:new Date().toISOString()},watch.id); }
    }
    const settings=await get("settings","settings");
    if(settings?.autoPublish) {
      const posts=(await list("post")).filter(p=>p.automatic && ["draft","processing"].includes(p.status) && p.channel!=="whatsapp").slice(0,6);
      for(const post of posts) { try { await doPublish(post.id); } catch { errors++; } }
    }
    await put("event",{type:"monitor",message:`Verificação: ${checked} anúncios, ${alerts} rascunhos, ${errors} erros.`,checked,alerts,errors});
    return {checked,alerts,errors};
  } finally { await remove("lock","monitor-lock"); }
}
async function doPublish(id:string) {
  let post=await get(id,"post"); if(!post) fail("Publicação não encontrada.");
  if(post.status==="published") return post;
  if(["sending","uncertain"].includes(post.status)) fail("Publicação com envio em andamento ou resultado incerto. Confira a rede social antes de reenviar.");
  if(post.offer.demo || post.offer.manual || post.channel==="whatsapp") fail("Use a exportação manual para demonstrações, cadastros manuais ou Status do WhatsApp.");
  if(!runtime().META_ACCESS_TOKEN || (post.channel==="facebook"&&!runtime().FACEBOOK_PAGE_ID) || (post.channel==="instagram"&&(!runtime().INSTAGRAM_USER_ID||!post.imageUrl))) fail("Configure o canal e, para Instagram, uma imagem JPEG pública antes de publicar.");
  const fresh=await currentOffer(post.offer.id,post.offer.marketplace,runtime());
  if(fresh.price!==post.offer.price) fail("O preço mudou. Atualize a oferta e gere um novo rascunho.");
  post={...post,offer:fresh,caption:caption(fresh,estimate(fresh,await list("coupon")).coupon,post.affiliate)};
  const claimed=await database().prepare("UPDATE records SET data=json_set(data,'$.status','sending') WHERE id=? AND kind='post' AND json_extract(data,'$.status') IN ('draft','processing','failed') RETURNING id").bind(id).first();
  if(!claimed) fail("Esta publicação já está sendo processada.");
  try {
    const result=await publish(post,runtime(),async p=>{await put("post",{...p,status:"sending"},id);});
    await put("post",result,id);
    await put("event",{type:"publish",message:`${post.channel}: ${result.status==="published"?"publicação concluída":"imagem em processamento"}.`,postId:id});
    return result;
  } catch(e:any) {
    // A timeout may occur after the provider accepted a request. Require reconciliation.
    await put("post",{...(await get(id,"post")||post),status:"uncertain",error:e.message},id); throw e;
  }
}
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}) {
  const {action}=await params;
  try {
    if(!await auth(request,action)) return json({error:"Entre com ChatGPT para acessar seus dados."},401);
    if(action==="bootstrap") {
      const [watches,coupons,posts,events,settings]=await Promise.all([list("watch"),list("coupon"),list("post"),list("event"),get("settings","settings")]);
      return json({watches,coupons:rankCoupons(coupons),posts,events:events.slice(0,50),settings:settings||{autoPublish:false},connections:{mercado:!!runtime().ML_ACCESS_TOKEN,shopee:!!(runtime().SHOPEE_APP_ID&&runtime().SHOPEE_SECRET),facebook:!!(runtime().META_ACCESS_TOKEN&&runtime().FACEBOOK_PAGE_ID),instagram:!!(runtime().META_ACCESS_TOKEN&&runtime().INSTAGRAM_USER_ID),monitor:!!runtime().MONITOR_SECRET}});
    }
    if(action==="search") {
      const q=new URL(request.url).searchParams.get("q")?.trim(); if(!q||q.length>200) fail("Digite um produto ou código MLB com até 200 caracteres.");
      const match=q.match(/(?:MLB-?)(\d{6,})/i),shop=q.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/i)||q.match(/-i\.(\d+)\.(\d+)/i);
      const coupons=await list("coupon") as Coupon[];
      const result=match?{offers:await hydrate([await getOffer(`MLB${match[1]}`,runtime())],coupons,runtime()),errors:[]}:shop?{offers:await hydrate([await currentOffer(`${shop[1]}-${shop[2]}`,"shopee",runtime())],coupons,runtime()),errors:[]}:await combinedSearch(q,new URL(request.url).searchParams.get("source")||"all",runtime(),coupons);
      return json({...result,checkedAt:new Date().toISOString()});
    }
    if(action==="top")return json({offers:await topOffers(await list("coupon") as Coupon[]),scan:await get("latest-scan","scan")});
    return json({error:"Recurso não encontrado."},404);
  } catch(e:any) {return json({error:e.message || "Não foi possível concluir a operação."},400);}
}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
  const {action}=await params;
  try {
    if(!await auth(request,action)) return json({error:"Entre com ChatGPT para acessar seus dados."},401);
    const origin=request.headers.get("Origin");
    if(origin && origin!==new URL(request.url).origin) return json({error:"Origem não autorizada."},403);
    if(action==="monitor") return json(await runMonitor());
    if(action==="scan")return json(await scanCatalog(runtime()));
    const body:any=await request.json();
    if(action==="watch") {
      if(body.delete) {await remove("watch",body.id);return json({ok:true});}
      if(body.toggle) {const watch=await get(body.id,"watch");if(!watch)fail("Alerta não encontrado."); return json(await put("watch",{...watch,enabled:!watch.enabled},body.id));}
      if((await list("watch")).length>=30) fail("Limite de 30 alertas nesta versão.");
      const offer=body.offer?.demo?body.offer:await currentOffer(body.offer?.id,body.offer?.marketplace,runtime());
      return json(await put("watch",{offer,target:positive(body.target),affiliate:affiliate(body.affiliate,offer.marketplace||"mercado"),imageUrl:body.imageUrl?validUrl(body.imageUrl):"",enabled:true,history:[{time:new Date().toISOString(),price:offer.price}]}));
    }
    if(action==="coupon") {
      if(body.delete) {await remove("coupon",body.id);return json({ok:true});}
      if(body.id&&!await get(body.id,"coupon"))fail("Cupom não encontrado.");
      if(!/^[\w-]{2,40}$/.test(body.code)) fail("Informe um código de cupom válido.");
      if(!["percent","fixed"].includes(body.type)) fail("Tipo de desconto inválido.");
      const value=positive(body.value,body.type==="percent"?100:100000);
      if(!Number.isFinite(Date.parse(body.expires))||Date.parse(body.expires)<=Date.now()) fail("Informe uma validade futura.");
      if(!body.restrictions?.trim()) fail("Descreva as restrições e condições do cupom.");
      const marketplace=body.marketplace==="shopee"?"shopee":"mercado";
      const coupon={code:body.code.toUpperCase(),marketplace,shopId:body.shopId?String(body.shopId).slice(0,60):undefined,itemId:body.itemId?String(body.itemId).slice(0,100):undefined,type:body.type,value,min:Number(body.min)?positive(body.min):0,cap:body.type==="percent"&&Number(body.cap)?positive(body.cap):0,category:String(body.category||"Todas").slice(0,100),expires:body.expires,source:affiliateUrl(String(body.source),marketplace),restrictions:String(body.restrictions).slice(0,2000),verified:!!body.verified,affiliate:affiliate(body.affiliate,marketplace),checkedAt:new Date().toISOString()};
      return json(await put("coupon",coupon,body.id));
    }
    if(action==="coupon-check") {
      const coupons=body.id?[await get(body.id,"coupon")]:await list("coupon");
      const checks=[];
      for(const coupon of coupons){if(!coupon)fail("Cupom não encontrado.");const check=checkCoupon(coupon);await put("coupon",{...coupon,checkedAt:check.checkedAt},coupon.id);checks.push({id:coupon.id,...check});}
      return json({checks});
    }
    if(action==="coupon-link") {
      const coupon=await get(body.id,"coupon");if(!coupon)fail("Cupom não encontrado.");
      return json(await put("coupon",{...coupon,affiliate:affiliateUrl(String(body.affiliate),coupon.marketplace||"mercado")},coupon.id));
    }
    if(action==="queue") {
      if(body.delete) {const p=await get(body.id,"post");if(p?.status==="sending")fail("Envio em andamento.");await remove("post",body.id);return json({ok:true});}
      if(!["whatsapp","instagram","facebook"].includes(body.channel)) fail("Selecione um canal.");
      const offer=body.offer?.demo?body.offer:await currentOffer(body.offer?.id,body.offer?.marketplace,runtime());
      const link=affiliate(body.affiliate,offer.marketplace||"mercado");
      const coupon=estimate(offer,[...await list("coupon"),...demoCoupons]).coupon;
      return json(await put("post",{offer,channel:body.channel,affiliate:link,caption:caption(offer,coupon,link),imageUrl:body.imageUrl?validUrl(body.imageUrl):"",status:"draft"}));
    }
    if(action==="publish") return json(await doPublish(body.id));
    if(action==="seller") {
      if(!/^\d+$/.test(String(body.id)))fail("Informe o ID numérico da loja Shopee.");
      const profile=new URL(validUrl(body.profile));if(!/(^|\.)shopee\.com\.br$/.test(profile.hostname))fail("Use o perfil oficial da loja na Shopee.");
      if(!body.confirmed)fail("Confirme que conferiu os números no perfil da loja, e não na página de um produto.");
      const seller=classifyShopee({id:String(body.id),name:String(body.name||body.id).slice(0,100),profile:profile.href,rating:positive(body.rating,5),reviews:Math.floor(positive(body.reviews,100000000)),source:"manual"});
      await put("seller",seller,`seller-shopee-${body.id}`);
      for(const offer of (await list("offer")).filter(o=>o.marketplace==="shopee"&&o.sellerId===String(body.id)))await put("offer",{...offer,seller},offer.recordId);
      return json(seller);
    }
    if(action==="manual") {
      const url=new URL(validUrl(body.url));if(!/(^|\.)shopee\.com\.br$/.test(url.hostname))fail("Informe o link completo do produto na Shopee.");
      const match=url.pathname.match(/\/product\/(\d+)\/(\d+)/)||url.pathname.match(/-i\.(\d+)\.(\d+)/);if(!match)fail("Use um link completo com shopId e itemId, sem encurtador.");
      if(!body.title?.trim())fail("Informe o nome do produto.");
      const offer={id:`${match[1]}-${match[2]}`,marketplace:"shopee" as const,sellerId:match[1],title:String(body.title).slice(0,250),price:positive(body.price),category:String(body.category||"Sem categoria").slice(0,100),url:url.href,affiliate:affiliate(body.affiliate,"shopee"),freeShipping:false,manual:true,checkedAt:new Date().toISOString(),seller:classifyShopee({id:match[1],name:match[1],profile:`https://shopee.com.br/shop/${match[1]}`})};
      return json((await hydrate([offer],await list("coupon") as Coupon[],runtime()))[0]);
    }
    if(action==="settings") {const previous=await get("settings","settings");return json(await put("settings",{...previous,autoPublish:body.autoPublish===undefined?previous?.autoPublish||false:body.autoPublish===true,...(body.queries?{queries:String(body.queries).split(",").map(q=>q.trim().slice(0,80)).filter(Boolean).slice(0,12)}:{})},"settings"));}
    return json({error:"Recurso não encontrado."},404);
  } catch(e:any) {return json({error:e.message || "Não foi possível concluir a operação."},400);}
}
