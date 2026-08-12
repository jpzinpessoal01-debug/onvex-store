# ONVEX

E-commerce full stack de artigos premium para Jiu-Jitsu. A loja, a área do cliente e o painel administrativo usam o mesmo banco real; produtos, preços, variantes, estoque, pedidos, cupons, banners, avaliações e configurações não ficam hardcoded no front-end.

<!-- deploy: futurista-mobile-first -->

## Arquitetura

| Camada | Implementação |
|---|---|
| Front-end | Next.js 16/Vinext, React 19, TypeScript estrito e CSS responsivo mobile first |
| Back-end | React Server Components e API Routes em Cloudflare Workers ou Vercel Functions |
| Banco | Cloudflare D1 no Sites e Neon PostgreSQL no Vercel, com Drizzle ORM |
| Arquivos | Cloudflare R2; o banco guarda apenas chave, URL, ordem e metadados |
| Autenticação | Sign in with ChatGPT e OAuth Google opcional, com sessão HMAC segura |
| Autorização | RBAC server-side: `CUSTOMER`, `ADMIN` e `SUPER_ADMIN` |
| Pagamento | Adaptador server-to-server configurável, PIX/cartão e webhook HMAC idempotente |
| E-mail | Adaptador HTTP configurável e templates ONVEX |

O preview do ChatGPT Sites usa D1/Drizzle. Quando publicado no Vercel, a mesma camada de domínio usa o `DATABASE_URL` provisionado pelo Neon através de um adaptador compatível com D1; o SQL de criação do schema e o seed são executados automaticamente durante o build. O banco não é simulado: constraints, índices, transações em lote, histórico de estoque e dados administrativos são persistidos.

A aplicação não recebe nem armazena senha. Cadastro e identidade podem usar Sign in with ChatGPT ou Google OAuth. A sessão Google é assinada com `AUTH_SECRET`; tokens OAuth são usados somente no callback e nunca persistidos. `emailVerifiedAt` é preenchido a partir da identidade confirmada pelo provedor.

## Funcionalidades principais

- catálogo vindo do banco, pesquisa por nome/categoria/SKU/descrição, filtros e paginação;
- produto com galeria, zoom, guia de tamanhos editável, cor/tamanho e estoque por combinação;
- carrinho anônimo ou autenticado, troca de variante, limite de estoque e cupom recalculado no servidor;
- checkout em cinco etapas, endereço em snapshot e total nunca aceito do navegador;
- pedido com itens em snapshot, eventos, rastreamento, pagamento e área do cliente;
- favoritos e avaliações somente após pedido entregue;
- painel com dashboard, produtos, galeria R2, categorias, estoque, movimentações, pedidos, clientes, cupons, avaliações, banners, relatórios, configurações, administradores e auditoria;
- templates de boas-vindas, pedido, pagamento, envio e entrega;
- sitemap, robots, metadata, Open Graph e Schema.org de produto.

## Instalação

Pré-requisitos:

- Node.js `>= 22.13`;
- npm;
- ambiente Cloudflare/ChatGPT Sites para o preview ou Vercel + Neon para produção.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate:local
npm run dev
```

Para testar o mesmo banco usado no Vercel, preencha `DATABASE_URL` com uma
conexão Neon e execute `npm run db:migrate:neon` antes de iniciar o projeto.

Abra a URL mostrada pelo Vite. O estado local de D1/R2 fica em `.wrangler/` e não é versionado.

## Variáveis de ambiente

Use [.env.example](./.env.example) como referência e nunca versione valores reais.

| Variável | Finalidade |
|---|---|
| `STORE_BASE_URL` | URL absoluta usada nos links dos e-mails |
| `NEXT_PUBLIC_SITE_URL` | canonical, sitemap e Open Graph |
| `DATABASE_URL` | conexão PostgreSQL criada pela integração Neon no Vercel |
| `SUPER_ADMIN_EMAIL` | cria/promove com segurança o primeiro superadministrador |
| `ADMIN_EMAILS` | allowlist inicial opcional, separada por vírgulas |
| `AUTH_SECRET` | segredo HMAC da sessão Google; gere um valor aleatório longo |
| `GOOGLE_CLIENT_ID` | client ID do OAuth Web no Google Cloud |
| `GOOGLE_CLIENT_SECRET` | segredo privado do OAuth Google |
| `GOOGLE_REDIRECT_URI` | callback HTTPS `/api/auth/google/callback` cadastrado no Google |
| `PAYMENT_PROVIDER` | nome do gateway registrado nos logs |
| `PAYMENT_API_URL` | endpoint server-to-server para criar pagamento |
| `PAYMENT_ACCESS_TOKEN` | credencial privada do gateway |
| `PAYMENT_WEBHOOK_SECRET` | segredo HMAC-SHA256 do webhook |
| `EMAIL_API_URL` | endpoint do provedor de e-mail |
| `EMAIL_API_KEY` | credencial privada de e-mail |
| `EMAIL_FROM` | remetente transacional |
| `BLOB_READ_WRITE_TOKEN` | token opcional do Vercel Blob para upload de imagens no painel |

Em desenvolvimento, o Vite injeta somente essa allowlist no Worker. No Sites,
`DB` e `BUCKET` são bindings declarados em `.openai/hosting.json`. No Vercel,
`DATABASE_URL` é criado automaticamente ao conectar o Neon; não é necessário
criar essa variável manualmente. Nunca versione valores reais.

## Banco, migrations e seed

O schema está em `db/schema.ts`; as migrations ficam em `drizzle/`.

```bash
# depois de alterar o schema
npm run db:generate

# aplicar todas as migrations no D1 local
npm run db:migrate:local
```

O seed inicial está na migration `0000`; migrations posteriores deixam o catálogo público com somente:

- Rash Guard ONVEX Performance;
- Fight Shorts ONVEX;
- Garrafa ONVEX Thermal;
- Chaveiro ONVEX Metal;
- Mochila ONVEX Training;
- variantes demonstrativas, banner, configurações e o cupom `ONVEX10`.

No Vercel, `scripts/migrate-neon.mjs` executa `scripts/neon-schema.sql` e
`scripts/neon-seed.sql` automaticamente no build. Se o banco Neon estiver
vazio, a primeira publicação já cria as tabelas e os cinco produtos da coleção.

No Sites, as migrations empacotadas em `dist/.openai/drizzle` são aplicadas pelo ciclo de checkpoint/deploy. Em Cloudflare próprio, use um `wrangler` de produção apontando para o D1 real e execute `wrangler d1 migrations apply` antes de liberar tráfego.

## Primeiro SUPER_ADMIN

1. Defina `SUPER_ADMIN_EMAIL` no ambiente seguro da hospedagem.
2. Entre na loja com exatamente esse e-mail usando Sign in with ChatGPT ou Google OAuth configurado.
3. O usuário é criado/promovido no servidor para `SUPER_ADMIN`.
4. Use `/admin/administradores` para atribuir os demais papéis.

Não existe senha fixa, conta administrativa seedada ou endpoint público de promoção. Somente `SUPER_ADMIN` pode alterar papéis.

## Pagamentos e webhook

Ao finalizar, o backend relê produto, variante, preço, promoção, cupom, frete e estoque. O pedido, os snapshots, a baixa de estoque, a movimentação, o pagamento pendente e o uso do cupom são gravados no mesmo lote transacional. A constraint `stock >= 0` faz a compra concorrente perder de forma segura quando duas pessoas tentam levar a última unidade.

Com `PAYMENT_PROVIDER=GOATPAY`, o adaptador usa `POST https://api.goatpay.com.br/v1/billings/create` e envia ao gateway:

- `X-API-Key` no servidor (nunca no navegador);
- `externalReference` com o número ONVEX;
- valor em BRL calculado pelo servidor;
- método `PIX` ou `CARD_CREDIT`;
- dados básicos do cliente;
- `Idempotency-Key`.

Ele reconhece respostas com `id`/`payment_id`, `checkout_url`/`init_point` e `qr_code` (inclusive o formato `point_of_interaction.transaction_data.qr_code`). Se o gateway retornar uma URL HTTPS, o cliente é redirecionado para o checkout seguro.

Configure o webhook para `POST /api/payments/webhook`. A assinatura esperada é o HMAC-SHA256 hexadecimal do corpo bruto, no header `x-goatpay-signature`:

```text
x-goatpay-signature: sha256=<assinatura>
```

O webhook rejeita corpo excessivo, assinatura inválida, moeda diferente de BRL, valor divergente e ID de pagamento conflitante. `webhook_events.event_id` e `payments.idempotency_key` impedem duplicação. Somente o webhook assinado muda um pagamento para pago; o front-end não possui essa permissão.

Sem credenciais de gateway, o sistema continua funcional em modo de pedido pendente e nunca simula aprovação.

## Estoque

Cada `ProductVariant` possui SKU, cor, tamanho, estoque e mínimo próprios. Toda mudança gera `InventoryMovement` com antes, alteração, depois, tipo, responsável, pedido e observação.

As operações críticas usam lote transacional D1:

- pedido: `SALE` e baixa;
- cancelamento: `CANCELATION` e devolução;
- reposição/ajuste: histórico e mudança juntos;
- cupom: reserva atômica no mesmo lote transacional impede ultrapassar limite global ou por cliente.

O painel permite reposição positiva, devolução e ajuste positivo/negativo; qualquer operação que produza estoque abaixo de zero falha no banco e retorna mensagem segura.

## Segurança

- validação e sanitização server-side;
- RBAC em todas as APIs e páginas administrativas;
- proteção de mesma origem/CSRF nas mutações;
- cookies de carrinho `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- rate limit persistente em checkout, contato e newsletter;
- webhook HMAC, limite de corpo e comparação constante;
- CSP, HSTS, `nosniff`, frame deny e política de permissões;
- totais e permissões nunca aceitos do cliente;
- soft delete de produtos/categorias e snapshots históricos;
- erros internos, SQL e stack traces não são enviados ao usuário;
- auditoria com administrador, ação, entidade, data, IP e dados relevantes.

## Testes e verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build

# tudo em sequência
npm run verify
```

Os testes cobrem preço/totais recalculados, cupom vencido e elegibilidade, estoque insuficiente, RBAC, disputa pela última unidade, reposição com histórico, limite concorrente de cupom, idempotência de pagamento/webhook e snapshot imutável do pedido.

## Produção no Vercel

1. Conecte o Neon ao projeto Vercel (a integração cria `DATABASE_URL` sozinha).
2. Mantenha `DATABASE_URL` como variável Production e Preview.
3. Cadastre os secrets de autenticação e do GoatPay na aba Environment Variables.
4. Faça um novo deploy. O build cria o schema e o seed automaticamente.
5. Configure `GOOGLE_REDIRECT_URI` com o domínio Vercel e, se for usar upload de
   imagens, conecte o Vercel Blob e adicione `BLOB_READ_WRITE_TOKEN`.
6. Entre com `SUPER_ADMIN_EMAIL` para liberar o painel `/admin`.

## Produção no Sites/Cloudflare

1. Provisione D1 e R2 através do ambiente Sites ou Cloudflare.
2. Cadastre as variáveis de `.env.example` como secrets/vars do Worker.
3. Configure o domínio em `NEXT_PUBLIC_SITE_URL` e `STORE_BASE_URL`.
4. Aplique migrations.
5. Execute `npm run verify`.
6. Publique o artefato gerado por `npm run build`.
7. Configure no gateway o webhook HTTPS e faça um teste real de pagamento de baixo valor.
8. Entre com `SUPER_ADMIN_EMAIL`, troque os contatos demonstrativos e revise frete, CPF e guia de tamanhos em `/admin/configuracoes`.

## Rotas

Loja: `/`, `/loja`, `/categoria/[slug]`, `/produto/[slug]`, `/carrinho`, `/checkout`, `/pedido/[id]`, `/login`, `/cadastro`, `/esqueci-minha-senha`, `/favoritos`, `/minha-conta`, `/minha-conta/pedidos`, `/minha-conta/enderecos`, `/contato`, `/sobre`, `/trocas-e-devolucoes`, `/privacidade` e `/termos`.

Admin: `/admin`, `/admin/produtos`, `/admin/produtos/novo`, `/admin/categorias`, `/admin/estoque`, `/admin/estoque/movimentacoes`, `/admin/pedidos`, `/admin/clientes`, `/admin/cupons`, `/admin/avaliacoes`, `/admin/banners`, `/admin/relatorios`, `/admin/configuracoes`, `/admin/administradores` e `/admin/logs`.
