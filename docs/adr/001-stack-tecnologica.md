# ADR-001 — Stack tecnológica

## Contexto

O produto precisa de frontend responsivo, APIs, renderização no servidor e uma base TypeScript única.

## Decisão

Usar Next.js 16 com App Router, React 19, TypeScript estrito, Tailwind CSS 4 e pnpm.

## Alternativas consideradas

- React SPA com backend separado: mais infraestrutura e contratos prematuros.
- Frameworks experimentais: incompatíveis com o requisito de estabilidade.

## Consequências

Frontend e endpoints convivem no mesmo projeto modular. Serviços podem ser extraídos futuramente se houver necessidade operacional comprovada.
