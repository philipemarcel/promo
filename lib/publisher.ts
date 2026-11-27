type Env = Record<string,string|undefined>;
async function graph(path: string, env: Env, body?: Record<string,string>) {
  const response=await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION || "v27.0"}/${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${env.META_ACCESS_TOKEN}`,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body:body?new URLSearchParams(body):undefined,signal:AbortSignal.timeout(20000)});
  const data:any=await response.json();
  if(!response.ok || data.error) throw new Error(`Meta recusou a operação (${data.error?.code || response.status}). Verifique token, permissões e conta profissional.`);
  return data;
}
export async function publish(post:any,env:Env,save:(post:any)=>Promise<void>) {
  if(post.offer.demo) throw new Error("Ofertas de demonstração não podem ser publicadas automaticamente.");
  if(post.channel==="whatsapp") throw new Error("Status do WhatsApp: exporte a arte e publique pelo aplicativo.");
  if(!env.META_ACCESS_TOKEN) throw new Error("Configure META_ACCESS_TOKEN nas variáveis secretas do servidor.");
  if(post.status==="uncertain") throw new Error("Resultado incerto. Confira a rede social antes de criar uma nova publicação.");
  if(post.channel==="facebook") {
    if(!env.FACEBOOK_PAGE_ID) throw new Error("Configure FACEBOOK_PAGE_ID.");
    const result=await graph(`${env.FACEBOOK_PAGE_ID}/feed`,env,{message:post.caption,link:post.affiliate || post.offer.url});
    return {...post,status:"published",externalId:result.id,publishedAt:new Date().toISOString()};
  }
  if(!env.INSTAGRAM_USER_ID) throw new Error("Configure INSTAGRAM_USER_ID.");
  if(!post.imageUrl || !/^https:\/\//.test(post.imageUrl)) throw new Error("Informe uma URL HTTPS pública de imagem JPEG para o Instagram.");
  let container=post.containerId;
  if(!container) { container=(await graph(`${env.INSTAGRAM_USER_ID}/media`,env,{image_url:post.imageUrl,caption:post.caption})).id; post={...post,containerId:container}; await save(post); }
  const check=await graph(`${container}?fields=status_code`,env);
  if(check.status_code==="IN_PROGRESS") return {...post,status:"processing",message:"Imagem em processamento. Consulte novamente em alguns instantes."};
  if(check.status_code!=="FINISHED") throw new Error("O Instagram não concluiu o processamento da imagem. Verifique formato e proporção.");
  const result=await graph(`${env.INSTAGRAM_USER_ID}/media_publish`,env,{creation_id:container});
  return {...post,status:"published",externalId:result.id,publishedAt:new Date().toISOString()};
}
