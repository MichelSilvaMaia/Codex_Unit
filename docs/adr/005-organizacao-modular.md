# ADR-005 — Organização modular

## Contexto

O produto crescerá por domínios, mas abstrações excessivas nesta fundação aumentariam o custo sem benefício imediato.

## Decisão

Separar rotas em `src/app`, componentes em `src/components`, infraestrutura em `src/lib` e código exclusivamente servidor em `src/server`. Novos módulos de negócio serão organizados em `src/features/<domínio>`.

## Alternativas consideradas

- Diretórios globais extensos de services: baixo senso de domínio.
- Microserviços desde o início: complexidade operacional prematura.

## Consequências

O projeto começa simples e permite crescimento vertical por feature. Extrações futuras dependerão de evidência de escala ou acoplamento.
