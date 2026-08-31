# Codex Unit

Fundação técnica de um SaaS multiempresa para gestão de reservas e locações. A Fase 2 adiciona identidade real, seleção segura de empresa e RBAC; funcionalidades comerciais e operacionais ainda não fazem parte do projeto.

## Status das fases

- Fase 2: **PARCIAL** até a execução real de migration → seed → autenticação → isolamento de tenant em PostgreSQL.
- Fase 3: domínio operacional de unidades, clientes, contratos, categorias e recursos individualizados. A validação integrada também depende do PostgreSQL real.

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

O seed cria permissões, os papéis Tenant Admin, Manager, Supervisor e Operator, além do tenant de demonstração. Ele só cria/atualiza uma credencial local quando `SEED_ADMIN_PASSWORD` for informada; nenhuma senha padrão fica no código.

## Executar a aplicação

```bash
pnpm dev
```

Rotas de identidade: `/login`, `/select-tenant`, `/account`, `/users`, `/roles` e `/api/auth/*`. Rotas operacionais: `/units`, `/customers`, `/customers/[id]`, `/contracts` e `/resources`. `/dashboard` e toda rota operacional exigem sessão e empresa ativa.

O login por e-mail e senha exige usuário ativo e credencial com hash bcrypt. Google e Microsoft são opcionais e só aceitam contas previamente cadastradas e ativas; o primeiro login social não cria acesso automático. Depois do login, uma única membership ativa é selecionada automaticamente, enquanto múltiplas empresas levam ao seletor. A empresa ativa fica em cookie assinado, `HttpOnly`, com validade curta, e sempre é revalidada no servidor.

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

`Resource.status` é administrativo e `Resource.operationalStatus` representa condições como manutenção ou indisponibilidade física. Não existe status `RESERVED`: disponibilidade de reserva é temporal. A Fase 4 deverá introduzir `Reservation`, `ReservationItem`, intervalos, prevenção de sobreposição e concorrência transacional sem transformar o cadastro do ativo em fonte definitiva de disponibilidade.
