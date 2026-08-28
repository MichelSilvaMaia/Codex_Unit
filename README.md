# Codex Unit

Fundação técnica de um SaaS multiempresa para gestão de reservas e locações. A Fase 1 estabelece arquitetura, persistência, autenticação, isolamento de tenant, auditoria, interface e testes; funcionalidades operacionais ainda não fazem parte do projeto.

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

O seed é somente para desenvolvimento e cria `admin@example.test`, sem senha ou credencial real.

## Executar a aplicação

```bash
pnpm dev
```

Rotas iniciais: `/`, `/login`, `/dashboard`, `/api/health` e `/api/auth/*`.

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
- Arquivos ficam atrás da interface `StorageProvider`.
- Erros públicos não expõem stack traces.
- Alterações de schema são feitas apenas por migrations versionadas.
