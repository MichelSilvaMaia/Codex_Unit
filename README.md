# Codex Unit

SaaS multiempresa para gestão de reservas e locações, com identidade real, isolamento de tenant, RBAC, domínio operacional e disponibilidade temporal protegida pelo PostgreSQL.

## Status das fases

- Fase 2: **VALIDADA EM POSTGRESQL** — migration, seed, credencial, membership, RBAC e isolamento.
- Fase 3: **VALIDADA EM POSTGRESQL** — domínio operacional e isolamento cross-tenant real.
- Fase 4: **VALIDADA EM POSTGRESQL** — reservas temporais e teste concorrente real contra dupla reserva.

## Requisitos

- Node.js 20.9 ou superior
- pnpm 11
- PostgreSQL 17 (local ou compatível)
- Docker opcional para o banco local

## Instalação

```bash
pnpm install
cp .env.example .env
```

Substitua os valores de desenvolvimento antes de usar a aplicação fora do ambiente local. Nunca versione `.env`.

## Variáveis de ambiente

- `DATABASE_URL`: URL PostgreSQL obrigatória.
- `AUTH_SECRET`: segredo de sessão com pelo menos 32 caracteres.
- `NEXTAUTH_URL`: origem pública da aplicação.
- `LOG_LEVEL`: `debug`, `info`, `warn` ou `error`.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: habilitam login Google quando ambos existem.
- `MICROSOFT_ENTRA_ID_CLIENT_ID` e `MICROSOFT_ENTRA_ID_CLIENT_SECRET`: habilitam login Microsoft; `MICROSOFT_ENTRA_ID_TENANT_ID` aceita `common` ou o tenant do Entra ID.
- `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`: credencial inicial somente para desenvolvimento. A senha deve ter de 12 a 128 caracteres.
- `OTP_HMAC_SECRET`: segredo com pelo menos 32 caracteres usado para proteger códigos OTP; obrigatório para solicitar e validar desafios.

## Banco local

```bash
docker compose up -d postgres
```

## Migrations e seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

O seed cria permissões, os papéis Tenant Admin, Manager, Supervisor, Operator e Portaria, além do tenant de demonstração. Ele só cria/atualiza uma credencial local quando `SEED_ADMIN_PASSWORD` for informada; nenhuma senha padrão fica no código.

## Executar a aplicação

```bash
pnpm dev
```

Rotas de identidade: `/login`, `/select-tenant`, `/account`, `/users`, `/roles` e `/api/auth/*`. Rotas operacionais: `/units`, `/customers`, `/customers/[id]`, `/contracts`, `/resources`, `/reservations`, `/reservations/new`, `/reservations/[id]`, `/pickups` e `/pickups/[id]`. `/dashboard` e toda rota operacional exigem sessão e empresa ativa.

O login por e-mail e senha exige usuário ativo e credencial com hash bcrypt. Google e Microsoft são opcionais e só aceitam contas previamente cadastradas e ativas; o primeiro login social não cria acesso automático. Depois do login, uma única membership ativa é selecionada automaticamente, enquanto múltiplas empresas levam ao seletor. A empresa ativa fica em cookie assinado, `HttpOnly`, com validade curta, e sempre é revalidada no servidor.

Na retirada, assinatura desenhada e OTP são métodos alternativos de aceite. O OTP tenta WhatsApp, SMS e e-mail por uma interface desacoplada de fornecedor. A implementação de desenvolvimento nunca opera em produção; conecte um adaptador real antes de disponibilizar OTP externamente.

Convites e redefinições de senha usam tokens aleatórios, armazenados somente como hash, com expiração e consumo único. Esta fase fornece os serviços de domínio; o envio de e-mail e as telas públicas de aceite/redefinição ficam para a integração de comunicação.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Estrutura

```text
prisma/              schema, migrations e seed
src/app/             App Router, páginas e endpoints
src/components/      componentes reutilizáveis
src/lib/             infraestrutura compartilhada
src/server/          auth, tenant, autorização, erros, logs e storage
src/types/           extensões de tipos
tests/               testes unitários e de isolamento
docs/adr/            decisões arquiteturais
```

## Convenções

- O tenant nunca é aceito livremente do corpo de uma requisição; ele é validado contra a membership do usuário autenticado.
- Autorização evolui por capacidades, não por condicionais de role espalhadas.
- Toda autorização de tenant é negada por padrão e consulta memberships, papéis e permissões atuais no banco; permissões não são persistidas na sessão.
- Arquivos ficam atrás da interface `StorageProvider`.
- Erros públicos não expõem stack traces.
- Alterações de schema são feitas apenas por migrations versionadas.

## Disponibilidade futura

`Resource.status` é administrativo e `Resource.operationalStatus` representa condições como manutenção, indisponibilidade física ou `IN_USE` após a saída. Não existe status `RESERVED`: disponibilidade é calculada pelos intervalos de `ReservationItem`. O PostgreSQL impede sobreposição concorrente de itens `PENDING_APPROVAL`, `APPROVED`, `CONFIRMED`, `READY_FOR_PICKUP` ou `RELEASED` por exclusion constraint GiST. Reservas urgentes mantêm as mesmas garantias e exigem justificativa.
