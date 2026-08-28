# Regras de desenvolvimento do Codex_Unit

## Processo obrigatório

- Antes de alterar arquivos, analisar o projeto, sua arquitetura, dependências, padrões e impactos.
- Aplicar somente as mudanças necessárias ao escopo solicitado e preservar o trabalho existente.
- Não usar comandos Git destrutivos nem apagar alterações preexistentes do usuário.
- Validar as mudanças com os testes, lint, typecheck e build disponíveis e relevantes.
- Relatar claramente o que foi alterado, o que foi validado e quaisquer riscos ou pendências.
- Para solicitações amplas, dividir o trabalho em entregas verticais e incrementais.
- Manter como prioridades segurança, isolamento multi-tenant, RBAC, auditoria, consistência transacional e responsividade.

## Protocolo Git ao final de cada entrega

1. Executar `git status` e revisar o diff.
2. Executar `git add .` somente após confirmar que não há arquivos sensíveis ou mudanças fora do escopo.
3. Criar um commit com mensagem curta e descritiva. Usar `Initial commit` apenas no primeiro commit do repositório.
4. Executar `git push -u origin main` no primeiro envio e `git push` nos seguintes.
5. Se não houver alterações, não criar commit vazio e informar que nada precisava ser versionado.
6. Não fazer push quando testes relevantes falharem, houver segredos no diff ou o usuário pedir explicitamente para não publicar.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
