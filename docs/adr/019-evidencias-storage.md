# ADR 019 — Evidências operacionais e storage

Evidências armazenam somente metadata no PostgreSQL e conteúdo no `StorageProvider`. O provider local privado atende desenvolvimento; acesso exige tenant e `pickups.view_evidence`. JPEG, PNG e WebP são verificados por assinatura binária, limitados centralmente a 8 MB e recebem SHA-256. Falha da gravação de metadata remove o arquivo como compensação.
