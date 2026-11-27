# PromoRadar

Central privada para buscar e acompanhar ofertas do Mercado Livre e da Shopee, estimar cupons e preparar publicações.

## Estado desta entrega

- Painel responsivo em português, Top 100, busca, alertas persistentes, cupons por plataforma/loja/produto, análise do vendedor, histórico, fila e exportação de arte JPEG 1080 × 1920.
- Integrações implementadas: Mercado Livre REST; Shopee Affiliate GraphQL; Facebook Pages feed; Instagram feed de imagem via contêiner.
- Os exemplos são sintéticos e identificados. Não são enviados automaticamente às redes sociais.
- Nenhuma credencial real foi fornecida, nenhuma conta social foi conectada e nenhum agendador está ativo.
- O afiliado Shopee ainda aguarda liberação da Open API. A consulta assinada precisa ser validada com o contrato e permissões da conta quando o acesso for liberado. Cadastro de produto e conferência de perfil podem ser feitos manualmente, com origem explícita.
- Sem acesso real às APIs, não é possível garantir que 100 ofertas estejam disponíveis nem confirmar a elegibilidade pessoal de cupons. A lista mostra até 100 promoções disponíveis, sem preenchimento fictício.

## Rodar localmente

Node 24 ou superior. Instale com `npm run install:ci`. Gere migrações com `npm run db:generate` apenas após mudar o schema. Execute `npm run build` para gerar `dist/server/wrangler.json`. Aplique cada migração pendente de `drizzle/`, em ordem, com:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/ARQUIVO.sql
npm run dev -- --hostname 127.0.0.1
```

Use o endereço local impresso e entre com ChatGPT. O ambiente de desenvolvimento simula uma identidade local; o Site privado usa a autenticação da hospedagem. As migrações locais não alteram a base hospedada.

## Credenciais

Os nomes estão em `.env.example`. Configure segredos na hospedagem pelas ferramentas Sites; em desenvolvimento use `.dev.vars` ignorado pelo Git. Não coloque tokens no navegador ou no manifesto.

| Variável | Uso |
| --- | --- |
| ML_ACCESS_TOKEN | Busca de anúncios, preços e perfis de vendedores; exige permissões do aplicativo. Um cadastro de afiliado não garante esse acesso. |
| SHOPEE_APP_ID / SHOPEE_SECRET | Open API de afiliados Shopee; liberação pendente. |
| META_ACCESS_TOKEN | Token compatível com as contas e permissões de publicação selecionadas. |
| FACEBOOK_PAGE_ID | Página na qual publicar; requer autorização e pages_manage_posts. |
| INSTAGRAM_USER_ID | Conta profissional vinculada ao fluxo Meta utilizado. |
| META_GRAPH_VERSION | Versão da Graph API, padrão v27.0. |
| MONITOR_SECRET | Segredo forte do endpoint de coleta e monitoramento. |

Os conectores sinalizam presença das variáveis, não aprovação das permissões. Respostas 401/403 são exibidas como falha, sem substituir resultados por dados fictícios. A renovação OAuth automática de tokens não foi implementada; tokens expirados precisam ser atualizados no ambiente.

## Top 100 e tempo de atualização

- A página real solicita nova coleta a cada 60 segundos enquanto aberta, se houver pelo menos uma API configurada. Uma trava evita coletas concorrentes e um cache mínimo de 60 segundos limita repetições.
- Mercado Livre: amostra de até 24 anúncios para cada um de até 12 termos; termos iniciais: fone Bluetooth, cafeteira, smartwatch, mouse gamer, air fryer e notebook. Shopee: até 3 páginas de 50 ofertas disponibilizadas à afiliação. A base reúne as consultas recentes e considera anúncios observados há menos de 24 horas. Não se afirma cobertura de todo o catálogo.
- A coleta conserva até 300 anúncios por execução e consulta perfis Mercado Livre com cache de 6 horas. Shopee Affiliate pode fornecer dados do produto e selo, mas isso não constitui reputação completa da loja. Sem métricas de perfil, a classificação permanece não verificada. Conferências manuais mostram origem e horário.
- Registra uma observação por anúncio a cada hora, por até 90 dias. A referência é a mediana dos preços diários anteriores ao dia atual no fuso America/Sao_Paulo. São necessários 7 dias distintos para uma referência suficiente. A referência histórica é do preço sem cupom; a estimativa atual considera o melhor cupom cadastrado compatível, sem acumular códigos.
- Com histórico suficiente, somente valores estimados abaixo da referência entram como promoção. Sem histórico, cupons ou descontos declarados no anúncio geram candidatas provisórias identificadas.
- Pontuação: queda percentual frente à mediana × 0,85 + reputação (alta +12, moderada +4, desconhecida 0, baixa −25) + fração de desconto do cupom × 10 + 2 por frete grátis informado. Históricos suficientes precedem provisórios. Comissão não entra na pontuação.
- Na Shopee, o menor preço do anúncio pode representar variantes diferentes. O painel alerta para comparar a mesma variação. Frete por CEP não conhecido não é apresentado como custo final confirmado.

## Reputação

A classificação é do PromoRadar, com evidências do perfil e data, não garantia de entrega.

Mercado Livre: alta com termômetro verde, pelo menos 100 transações concluídas e 95% de avaliações positivas; baixa para vermelho/laranja ou pelo menos 10% negativas com 30 transações concluídas. Demais perfis com termômetro são moderados; ausência de dados gera não verificado. O campo real_level tem prioridade se disponível durante proteção da reputação.

Shopee: alta com nota da loja de pelo menos 4,7 e 100 avaliações; baixa com até 3,5 e pelo menos 30 avaliações; faixas intermediárias com ao menos 30 são moderadas. Nota do produto e selo isolado não bastam. Como a API de afiliados pode não disponibilizar avaliação completa da loja, há conferência manual do perfil, identificada como manual.

## Cupons

Cadastro manual de códigos obtidos em fontes oficiais, com plataforma, loja/produto opcionais, categoria, validade, valor mínimo, percentual/valor fixo e teto. Não há um feed automático de todos os cupons disponível nesta instalação. Regras da conta, pagamento, disponibilidade de campanha e resgate exigem confirmação no carrinho. Não prometemos aplicação de cupons personalizados.

## Monitoramento em segundo plano

O processo independente `node scripts/monitor.mjs` executa coleta e alertas a cada 5 minutos. Precisa de Node em um servidor sempre ligado e destas variáveis do processo:

- PROMORADAR_URL: origem HTTPS do Site.
- MONITOR_SECRET: mesmo segredo configurado no Site.
- OAI_SITES_SERVICE_TOKEN: credencial de acesso de serviço para este Site privado, obtida pelo mecanismo suportado pela hospedagem; não é token do Mercado Livre nem da Meta.

O processo não foi iniciado. Não há verificação de serviço sem supervisão até provisionar e testar essas credenciais. A autenticação do serviço na hospedagem e a autorização do endpoint são verificações independentes. Não torne o Site público para contornar autenticação.

Até 30 alertas por execução. Ao atingir o preço do anúncio, são criados rascunhos deduplicados por alerta/preço/canal. Alertas fictícios e cadastros manuais não são consultados automaticamente. Publicação automática fica desativada inicialmente. Instagram exige URL pública JPEG cadastrada no alerta; links privados do Site não servem para a Meta buscar a imagem.

Antes de enviar, o anúncio é consultado novamente e mudanças de preço interrompem o envio. Cupons são recalculados. Envios concorrentes são bloqueados. Resultados incertos exigem conferência na rede; não são reenviados automaticamente.

Status do WhatsApp usa exportação manual de arte e legenda. Não há automação de WhatsApp Web nem publicação oficial de Status implementada.

## Verificação

```powershell
node scripts/test.mjs
npx tsc --noEmit
npm run build
```

Testes cobrem regras financeiras dos cupons, separação de plataformas, amostragem histórica, reputação e limite do ranking. Os fluxos externos precisam ser testados com contas e credenciais reais após conexão.

## Fontes oficiais

- Mercado Livre, itens e buscas: https://developers.mercadolivre.com.br/pt_br/itens-e-buscas
- Reputação: https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/reputacao-de-vendedores
- Shopee Open API: https://affiliate.shopee.com.br/open_api
- Capacidades da API Shopee: https://help.shopee.sg/portal/10/article/191702-API-Access
- Facebook Pages: https://developers.facebook.com/docs/pages-api/posts/
- Instagram: https://developers.facebook.com/docs/instagram-platform/content-publishing/
