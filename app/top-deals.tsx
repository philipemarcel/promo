"use client";
import {useEffect,useState,type ReactNode} from "react";
import {Radar,RefreshCw,ChevronDown,ShieldCheck,Clock,Plus,Info,TicketPercent,TrendingDown,Star} from "lucide-react";
import {type Offer,type Coupon,estimate} from "../lib/offers";
import {demoRanking} from "../lib/demo-ranking";
import {trustLabels,rankOffers} from "../lib/ranking";

export default function TopDeals({demo,onDemo,coupons,connections,api,card,onManual,onSettings}:{demo:boolean;onDemo:(v:boolean)=>void;coupons:Coupon[];connections:{mercado:boolean;shopee:boolean};api:(action:string,body?:any)=>Promise<any>;card:(o:Offer)=>ReactNode;onManual:()=>void;onSettings:()=>void}) {
  const [offers,setOffers]=useState<Offer[]>([]),[scan,setScan]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[source,setSource]=useState("all"),[trust,setTrust]=useState("all"),[withCoupon,setWithCoupon]=useState(false),[historyOnly,setHistoryOnly]=useState(false),[auto,setAuto]=useState(true);
  async function load(collect=false){setLoading(true);try{if(collect)await api("scan",{});const r=await api("top");setOffers(r.offers);setScan(r.scan);setError("");}catch(e:any){setError(e.message);}finally{setLoading(false);}}
  useEffect(()=>{if(!demo)void load(connections.mercado||connections.shopee);},[demo]);
  useEffect(()=>{if(!auto||demo)return;const timer=setInterval(()=>void load(connections.mercado||connections.shopee),60000);return()=>clearInterval(timer);},[auto,demo,connections.mercado,connections.shopee]);
  const all=demo?rankOffers(demoRanking().map(o=>({...o,history:o.history?{...o.history,discount:o.history.median?Math.round((1-estimate(o,coupons).total/o.history.median)*10000)/100:undefined}:undefined})),coupons):offers;
  const shown=all.filter(o=>(source==="all"||(o.marketplace||"mercado")===source)&&(trust==="all"||o.seller?.trust===trust)&&(!withCoupon||!!estimate(o,coupons).coupon)&&(!historyOnly||o.history?.sufficient));
  const counts = [
    { icon: TrendingDown, label: "Ofertas com histórico suficiente", value: all.filter(offer => offer.history?.sufficient).length },
    { icon: TicketPercent, label: "Ofertas com cupom compatível", value: all.filter(offer => estimate(offer, coupons).coupon).length },
    { icon: ShieldCheck, label: "Ofertas de vendedores confiáveis", value: all.filter(offer => offer.seller?.trust === "high").length },
  ];
  return <>
    <section className="ranking-intro" aria-labelledby="ranking-title">
      <div className="ranking-intro-main">
        <p className="ranking-markets">Mercado Livre + Shopee</p>
        <h2 id="ranking-title"><span>Top 100</span> no seu radar</h2>
        <p className="ranking-summary">Compare histórico de preço, cupons e reputação do vendedor.</p>
      </div>
      <div className="ranking-limit" aria-label={`${all.length} de 100 ofertas no ranking`}>
        <Star className="ranking-star" aria-hidden="true" />
        <span className="ranking-count">{all.length}<small> / 100</small></span>
        <span className="ranking-limit-label">ofertas no ranking</span>
      </div>
    </section>
    <div className="ranking-stats" aria-label="Resumo do ranking">
      {counts.map(({icon:Icon, label, value}) => (
        <div key={label}>
          <Icon size={18} aria-hidden="true" />
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
    <div className="ranking-controls">
      <section className="ranking-toolbar" aria-label="Fonte e atualização das ofertas"><div className="source-control"><button className={demo?"selected":""} aria-pressed={demo} onClick={()=>onDemo(true)}>Demonstração</button><button className={!demo?"selected":""} aria-pressed={!demo} onClick={()=>onDemo(false)}>Ofertas reais</button></div><div className="ranking-updates"><label className="checkbox-row"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Atualizar a cada 60 s</label><button className="button outline" disabled={loading||demo} onClick={()=>load(true)}><RefreshCw size={16} className={loading?"spin":""}/>{loading?"Consultando fontes…":"Atualizar agora"}</button><button className="button outline" onClick={onManual}><Plus size={16}/>Oferta Shopee</button></div></section>
      <div className="ranking-filters" role="group" aria-label="Filtrar ranking"><label className="select-wrap"><select value={source} onChange={e=>setSource(e.target.value)} aria-label="Plataforma"><option value="all">Todas as plataformas</option><option value="mercado">Mercado Livre</option><option value="shopee">Shopee</option></select><ChevronDown size={14}/></label><label className="select-wrap"><ShieldCheck size={15}/><select value={trust} onChange={e=>setTrust(e.target.value)} aria-label="Confiabilidade do vendedor"><option value="all">Todos os vendedores</option>{Object.entries(trustLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><ChevronDown size={14}/></label><button className={`filter-chip ${withCoupon?"on":""}`} aria-pressed={withCoupon} onClick={()=>setWithCoupon(!withCoupon)}><TicketPercent size={15}/>Com cupom</button><button className={`filter-chip ${historyOnly?"on":""}`} aria-pressed={historyOnly} onClick={()=>setHistoryOnly(!historyOnly)}><Clock size={15}/>Histórico comprovado</button></div>
    </div>
    <div className={`data-note ranking-data-note ${demo?"":"real"}`}><span>{demo?"Exemplos de ofertas":"Ofertas coletadas"}</span><p>{demo?"Preços, histórico e vendedores fictícios.":scan?`Última coleta: ${new Date(scan.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · ${scan.count} anúncios consultados`:"Aguardando a primeira coleta de ofertas."}</p></div>
    {!demo&&!connections.shopee&&<div className="notice warning"><Info size={18}/><p>Shopee: aguardando liberação da Open API. Ofertas cadastradas manualmente ficam identificadas e não têm atualização automática.</p><a href="https://affiliate.shopee.com.br/open_api" target="_blank" rel="noreferrer">Solicitar acesso</a></div>}
    {error&&<div role="alert" className="notice warning"><Info size={18}/><p>{error}</p></div>}
    {!demo&&scan?.errors?.length>0&&<details className="scan-errors"><summary>Avisos da última coleta ({scan.errors.length})</summary>{scan.errors.map((e:string)=><p key={e}>{e}</p>)}</details>}
    {shown.length?<div className="product-grid ranked-grid">{shown.map((o,i)=><div className="ranked-offer" key={`${o.marketplace||"mercado"}-${o.id}`}><span className="rank-number">#{i+1}</span>{card(o)}</div>)}</div>:<div className="empty"><span><Radar size={30}/></span><h3>{loading?"Consultando as fontes…":"Seu Top 100 começa com dados reais"}</h3><p>{all.length?"Nenhuma oferta corresponde aos filtros selecionados.":"Conecte as APIs para coletar ofertas e iniciar o histórico. A lista exibe até 100 resultados disponíveis, sem preencher posições com dados inventados."}</p><button className="button primary" onClick={onSettings}>Ver conexões</button></div>}
    <details className="ranking-method" open><summary><Info size={17}/>Como as ofertas são classificadas</summary><p>A comparação usa a mediana dos preços diários observados nos últimos 90 dias, excluindo o dia atual. São necessários pelo menos 7 dias distintos para considerar o histórico suficiente. Antes disso, a oferta fica em análise. A posição combina a redução do valor estimado em relação à mediana, a avaliação do vendedor e, em menor peso, o desconto por cupom e o frete grátis informado. A comissão de afiliado não influencia o ranking.</p><p>* Cupom compatível significa que as regras cadastradas de plataforma, loja, produto, categoria, compra mínima e validade foram atendidas. Elegibilidade da conta, pagamento, CEP e limites da campanha exigem confirmação no carrinho. Não acumulamos cupons. Na Shopee, preços “a partir de” comparam o menor valor do mesmo anúncio, e não garantem a mesma variação.</p><p>Confiabilidade é uma classificação do PromoRadar baseada nos dados disponíveis do perfil, com fonte e horário visíveis. Na Shopee, nota do produto e selo da loja não bastam para atribuir alta confiança. Uma fonte indisponível aparece como não verificada. A atualização de 60 segundos funciona enquanto esta página está aberta; a coleta com a página fechada depende do agendador.</p></details>
  </>;
}
