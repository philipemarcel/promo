"use client";
import {useEffect,useState,type MouseEvent} from "react";
import {MessageCircle,Link2,Check,Copy} from "lucide-react";
import {estimate,type Coupon,type Offer} from "../lib/offers";
import {couponShareText,productShareText,whatsappShareUrl} from "../lib/sharing";

export default function WhatsAppShare({offer,coupon,coupons,initialLink,onSaveLink,onCopy}:{offer?:Offer|null;coupon?:Coupon|null;coupons:Coupon[];initialLink:string;onSaveLink?:(link:string)=>Promise<boolean>;onCopy:(text:string)=>void}) {
  const [link,setLink]=useState(initialLink),[saving,setSaving]=useState(false),[saved,setSaved]=useState(""),[now,setNow]=useState(Date.now()),[hint,setHint]=useState("");
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const message=(time:number)=>coupon?couponShareText(coupon,link,time):productShareText(offer!,estimate(offer!,coupons,time).coupon,link,time);
  function recheck(event:MouseEvent<HTMLAnchorElement>) {
    const time=Date.now();
    try{if(message(time)===text)return;}catch{}
    event.preventDefault();setNow(time);setHint("A validade mudou. Confira a prévia atualizada antes de compartilhar.");
  }
  let text="",error="";
  try{text=message(now);}catch(e:any){error=e.message;}
  return <div className="modal-body form-grid">
    <p className="share-target">{coupon?`Cupom ${coupon.code}`:offer?.title}</p>
    <label>Link de afiliado para incluir na mensagem<input type="url" value={link} onChange={e=>{setLink(e.target.value);setSaved("");}} placeholder={coupon?.marketplace==="shopee"||offer?.marketplace==="shopee"?"https://s.shopee.com.br/…":"https://meli.la/…"} autoFocus required/></label>
    <p className="form-hint">Use o link gerado na sua conta de afiliado, da mesma plataforma da oferta. O domínio é conferido; a atribuição da comissão depende do seu programa.</p>
    {error&&link&&<p className="error-text" role="alert">{error}</p>}
    {hint&&<p className="form-hint" role="status">{hint}</p>}
    {!error&&<><label>Prévia da mensagem<pre className="caption-preview">{text}</pre></label><a className="button whatsapp-button share-open" href={whatsappShareUrl(text)} onClick={recheck} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Compartilhar no WhatsApp</a><div className="share-secondary"><button className="button outline" type="button" onClick={()=>onCopy(text)}><Copy size={16}/>Copiar mensagem</button>{onSaveLink&&<button className="button outline" type="button" disabled={saving||saved===link} onClick={async()=>{setSaving(true);try{if(await onSaveLink(link))setSaved(link);}finally{setSaving(false);}}}>{saved===link?<Check size={16}/>:<Link2 size={16}/>} {saved===link?"Link salvo":"Salvar link no cupom"}</button>}</div></>}
    {!link&&<p className="form-hint">Informe seu link de afiliado para preparar a mensagem.</p>}
    <p className="form-hint">O WhatsApp abrirá com a mensagem pronta para você escolher o contato ou grupo e confirmar o envio.</p>
  </div>;
}
