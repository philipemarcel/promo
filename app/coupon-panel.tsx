"use client";
import {useState,type FormEvent} from "react";
import {TicketPercent,ShieldCheck,Copy,ExternalLink,Trash2,MessageCircle,Pencil,RefreshCw,ChevronDown,Star,Plus} from "lucide-react";
import {checkCoupon,rankCoupons,money,marketName,type Coupon} from "../lib/offers";

const date=(v:string)=>new Date(v).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
const labels:Record<string,string>={ready:"Regras conferidas",incomplete:"Dados incompletos",review:"A conferir",expired:"Expirado"};
export default function CouponPanel({coupons,demo,onDemo,onNew,onEdit,onShare,onCheck,onDelete,onCopy,busy}:{coupons:Coupon[];demo:boolean;onDemo:(v:boolean)=>void;onNew:()=>void;onEdit:(c:Coupon)=>void;onShare:(c:Coupon)=>void;onCheck:(id?:string)=>void;onDelete:(id:string)=>void;onCopy:(v:string)=>void;busy:boolean}) {
  const [platform,setPlatform]=useState("all");
  const sorted=rankCoupons(coupons.filter(c=>!!c.demo===demo&&(platform==="all"||(c.marketplace||"mercado")===platform)));
  const best=sorted.find(c=>checkCoupon(c).ready),max=best?checkCoupon(best).maximum:null;
  return <>
    <div className="notice"><ShieldCheck size={20}/><p>O destaque considera o <b>desconto máximo em reais</b>. A verificação confere validade, teto e regras cadastradas. A elegibilidade da sua conta e a disponibilidade da campanha precisam ser confirmadas no carrinho.</p></div>
    <div className="coupon-ranking-toolbar"><div className="source-control"><button className={demo?"selected":""} onClick={()=>onDemo(true)}>Demonstração</button><button className={!demo?"selected":""} onClick={()=>onDemo(false)}>Meus cupons</button></div><label className="select-wrap"><select aria-label="Plataforma dos cupons" value={platform} onChange={e=>setPlatform(e.target.value)}><option value="all">Todas as plataformas</option><option value="mercado">Mercado Livre</option><option value="shopee">Shopee</option></select><ChevronDown size={14}/></label><span className="coupon-order">Maior desconto máximo primeiro</span><button className="button outline" disabled={busy||demo||!sorted.length} onClick={()=>onCheck()}><RefreshCw size={16}/>Verificar regras</button></div>
    {demo&&<p className="coupon-demo-note">Exemplos fictícios: 20% com teto de R$ 1.000 tem destaque; 50% com teto de R$ 5 fica abaixo.</p>}
    {sorted.length?<div className="coupon-grid">{sorted.map(c=>{
      const check=checkCoupon(c),featured=check.ready&&check.maximum===max;
      return <article className={`coupon-card ${featured?"coupon-featured":""}`} data-marketplace={c.marketplace||"mercado"} data-status={check.status} key={c.id}>
        {featured&&<div className="coupon-featured-ribbon"><Star size={15}/>Maior desconto máximo</div>}
        <div className="coupon-card-top"><TicketPercent size={25}/><span className={`badge ${check.ready?"green":""}`}>{labels[check.status]}</span></div>
        <span className="coupon-market">{marketName(c)}{c.demo?" · exemplo fictício":""}</span>
        <strong className="coupon-max-value">{check.maximum!==null?`Até ${money(check.maximum)}`:"Teto não informado"}</strong>
        <span className="coupon-percent-detail">{c.type==="percent"?`${c.value}% de desconto`:`Desconto fixo de ${money(c.value)}`}</span>
        <button className="coupon-code" onClick={()=>onCopy(c.code)} aria-label={`Copiar cupom ${c.code}`}>{c.code}<Copy size={15}/></button>
        <dl className="coupon-numbers"><div><dt>Compra mínima</dt><dd>{money(c.min)}</dd></div>{check.spendToMax!==null&&c.type==="percent"&&<div><dt>Compra para atingir o teto*</dt><dd>{money(check.spendToMax)}</dd></div>}<div><dt>Válido até</dt><dd>{date(c.expires)}</dd></div></dl>
        <p><b>Categoria:</b> {c.category}{c.shopId?` · Loja ${c.shopId}`:""}{c.itemId?` · Produto ${c.itemId}`:""}</p><p>{c.restrictions}</p>
        {check.issues.length>0&&<ul className="coupon-issues">{check.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
        {c.checkedAt&&<small>Regras verificadas: {date(c.checkedAt)}</small>}
        <button className="button whatsapp-button coupon-share" disabled={!check.ready} onClick={()=>onShare(c)}><MessageCircle size={17}/>Compartilhar no WhatsApp</button>
        <div className="coupon-footer">{!c.demo?<><a href={c.source} target="_blank" rel="noreferrer">Conferir fonte<ExternalLink size={14}/></a><div className="coupon-card-actions"><button className="icon-button" disabled={busy} aria-label={`Verificar regras de ${c.code}`} onClick={()=>onCheck(c.id)}><RefreshCw size={16}/></button><button className="icon-button" aria-label={`Editar ${c.code}`} onClick={()=>onEdit(c)}><Pencil size={16}/></button><button className="icon-button danger" disabled={busy} aria-label={`Excluir ${c.code}`} onClick={()=>onDelete(c.id)}><Trash2 size={16}/></button></div></>:<small>Demonstração · não usar em compras</small>}</div>
      </article>;
    })}</div>:<div className="empty"><span><TicketPercent size={29}/></span><h3>Seus cupons ficam aqui</h3><p>Cadastre o código, o teto e seu link de afiliado para comparar o potencial de economia e compartilhar.</p><button className="button primary" onClick={onNew}><Plus size={16}/>Cadastrar cupom</button></div>}
    <p className="footnote">* Potencial de economia, sujeito às regras. O teto de R$ 1.000 com desconto de 20% exige pelo menos R$ 5.000 em itens elegíveis. Nos produtos, a escolha do cupom usa a economia efetiva naquela compra. Cupons sem teto informado, expirados ou sem regras conferidas não recebem destaque.</p>
  </>;
}

export function CouponForm({coupon,onSave,busy}:{coupon?:Coupon|null;onSave:(data:any)=>Promise<void>;busy:boolean}) {
  const [type,setType]=useState(coupon?.type||"percent");
  const originalLocal=coupon?new Date(Date.parse(coupon.expires)-3*3600000).toISOString().slice(0,16):undefined;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),body:any=Object.fromEntries(f);body.id=coupon?.id;body.verified=f.has("verified");body.cap=type==="fixed"?0:body.cap||0;body.expires=coupon&&body.expires===originalLocal?coupon.expires:new Date(`${body.expires}-03:00`).toISOString();await onSave(body);}
  return <form className="modal-body form-grid" onSubmit={submit}>
    <label>Plataforma<select name="marketplace" defaultValue={coupon?.marketplace||"mercado"}><option value="mercado">Mercado Livre</option><option value="shopee">Shopee</option></select></label>
    <div className="form-pair"><label>Código<input name="code" defaultValue={coupon?.code} placeholder="Código oficial" required pattern="[A-Za-z0-9_-]{2,40}" autoFocus/></label><label>Validade (Brasília)<input name="expires" type="datetime-local" defaultValue={originalLocal} required/></label></div>
    <div className="form-pair"><label>Tipo<select name="type" value={type} onChange={e=>setType(e.target.value as Coupon["type"])}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label><label>Desconto<input name="value" type="number" min="0.01" max={type==="percent"?100:100000} step="0.01" defaultValue={coupon?.value} required/></label></div>
    <div className="form-pair"><label>Compra mínima (R$)<input name="min" type="number" min="0" step="0.01" defaultValue={coupon?.min||0}/></label><label>Desconto máximo (R$)<input name="cap" type="number" min="0" step="0.01" defaultValue={coupon?.cap||""} placeholder={type==="fixed"?"O próprio valor fixo":"Teto em reais"} disabled={type==="fixed"}/></label></div>
    <p className="form-hint">{type==="fixed"?"Em cupons de valor fixo, o desconto máximo é o próprio valor informado.":"Sem teto informado, o cupom fica incompleto e não participa das estimativas nem do destaque."}</p>
    <label>Categoria ou código da categoria<input name="category" defaultValue={coupon?.category||"Todas"}/><small>Use “Todas” ou o código exibido na oferta.</small></label>
    <div className="form-pair"><label>ID da loja (opcional)<input name="shopId" defaultValue={coupon?.shopId}/></label><label>ID do produto (opcional)<input name="itemId" defaultValue={coupon?.itemId}/></label></div>
    <label>Fonte oficial das regras<input name="source" type="url" defaultValue={coupon?.source} placeholder="https://www.mercadolivre.com.br/… ou https://shopee.com.br/…" required/></label>
    <label>Seu link de afiliado <span className="optional">opcional</span><input name="affiliate" type="url" defaultValue={coupon?.affiliate} placeholder="Link gerado pelo seu programa de afiliados"/><small>Será incluído no compartilhamento do cupom. Deve ser da mesma plataforma.</small></label>
    <label>Restrições e condições<textarea name="restrictions" defaultValue={coupon?.restrictions} placeholder="Ex.: conta selecionada, Pix, uso no app…" rows={3} required/></label>
    <label className="checkbox-row"><input type="checkbox" name="verified" defaultChecked={coupon?.verified}/>Conferi as regras na fonte. Usar na estimativa de preço.</label>
    <button className="button primary" disabled={busy}><TicketPercent size={16}/>Salvar cupom</button>
  </form>;
}
