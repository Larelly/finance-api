# Finance API

API REST de finanças pessoais, escrita como projeto de portfólio no padrão de um sistema de produção: migrations versionadas, testes de integração contra Postgres real, Docker e CI.

## Stack

Node 22 + TypeScript (strict) · Fastify · PostgreSQL 16 · Prisma · Zod · JWT (access + refresh com revogação) · Vitest + Supertest + Testcontainers · Docker + docker-compose · GitHub Actions · OpenAPI 3.1.

## Como rodar

### Com Docker (recomendado)

```bash
docker compose up --build
```

A API sobe em `http://localhost:3000`, aplica as migrations automaticamente no start (`docker/entrypoint.sh`) e responde em `http://localhost:3000/health`. Documentação interativa em `http://localhost:3000/docs`.

### Local (sem Docker, para desenvolvimento)

Requer um Postgres 16 rodando (pode usar só o serviço `postgres` do compose: `docker compose up postgres`).

```bash
cp .env.example .env
npm install
npm run prisma:deploy   # aplica as migrations
npm run dev
```

### Testes

```bash
npm test              # suíte de integração (sobe um Postgres via Testcontainers) + unitários
npm run test:coverage # com relatório de cobertura
```

Os testes de integração exigem Docker disponível localmente (usado pelo Testcontainers para subir um Postgres 16 descartável por execução). Não é necessário configurar `DATABASE_URL` para os testes — o container é provisionado e a URL é injetada automaticamente.

## Decisões de arquitetura

- **Dinheiro em centavos, inteiro (`amount_cents BIGINT`).** Nunca `float`: erros de arredondamento em ponto flutuante são inaceitáveis quando o valor representa dinheiro. A API sempre responde em centavos; a divisão por 100 é responsabilidade de quem consome a API.
- **`userId` sempre do token, nunca de query/body/header.** Toda query no banco filtra por `user_id`; isso é o que garante isolamento entre usuários (testado explicitamente — ver `tests/integration/*.test.ts`, casos "não deixa usuário A ver dado do usuário B").
- **Agregação no banco.** O relatório mensal usa `GROUP BY` (`Prisma.groupBy`) em vez de carregar transações para somar em JavaScript — essencial para escalar com o volume de transações.
- **Erro padronizado (RFC 7807).** Um único error handler (`src/shared/http/error-handler.ts`) traduz exceções de domínio (`ProblemError`), erros de validação do Zod e erros inesperados para o mesmo formato `application/problem+json`. Nenhuma rota monta erro na mão.
- **Env validada no boot.** `src/shared/config/env.ts` valida todas as variáveis de ambiente com Zod assim que o processo sobe; falta de uma variável obrigatória mata o processo imediatamente, não na primeira request.
- **Camadas.** Rota valida (via schema Zod) e delega → service concentra regra de negócio → repository concentra SQL/Prisma. O service nunca conhece `req`/`res`, o que torna toda a regra de negócio testável sem subir um servidor HTTP.

### Por que o timezone é o ponto mais delicado do projeto

O servidor roda em UTC (isso é garantido no `docker-compose.yml`, no Dockerfile e nos testes, que fixam `TZ=UTC`). Mas "agosto" para um usuário em `America/Sao_Paulo` não é o mesmo intervalo UTC que "agosto" para um usuário em `Asia/Tokyo` — e não pode ser, porque os dois vêem o mesmo extrato com base no relógio de onde estão.

Por isso:

1. Toda transação é persistida com `TIMESTAMPTZ` (instante absoluto, sem ambiguidade).
2. O relatório mensal recebe um `timezone` explícito e calcula o início/fim do mês *nesse* fuso (`src/shared/time/monthRange.ts`), convertendo depois para o instante UTC equivalente — usando `Intl.DateTimeFormat` com um `timeZone` explícito, nunca o fuso do processo.
3. Toda consulta por data usa intervalo semiaberto (`occorred_at >= inicio AND occurred_at < fim`), nunca `BETWEEN`, para não incluir por engano o primeiro instante do mês seguinte.

O teste que mais importa no projeto (`tests/integration/reports.test.ts`, "THE central test") cria uma transação em `2026-09-01T02:30:00Z` — que é `2026-08-31T23:30` em São Paulo (UTC-3) — e verifica que ela aparece no relatório de **agosto**, não no de setembro. Se esse teste passar só porque a máquina que roda os testes está em `-03`, ele não prova nada; por isso `TZ=UTC` é fixado explicitamente em `tests/setup.ts` e no container do Testcontainers.

## Endpoints

Prefixo `/api/v1`. Ver `/docs` para a especificação completa (OpenAPI 3.1, gerada a partir dos schemas Zod em `src/shared/http/openapi.ts`).

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET|POST /categories`, `PATCH|DELETE /categories/:id`
- `GET|POST /transactions`, `GET|PATCH|DELETE /transactions/:id`
- `GET /reports/monthly?month=YYYY-MM&timezone=America/Sao_Paulo`
- `GET /health`, `GET /ready`, `GET /docs`

## Estrutura

```
src/
  modules/{auth,categories,transactions,reports}/  # routes -> service -> repository, schemas Zod
  shared/{db,http,config,time}/
  app.ts     # monta a instância do Fastify, sem side effect de listen
  server.ts  # lê env, chama listen, cuida de shutdown gracioso
tests/
  unit/         # monthRange — puro, sem banco
  integration/  # contra Postgres real via Testcontainers
```

`app.ts` exporta a instância pronta (`buildApp()`) sem escutar porta — é isso que os testes de integração usam com Supertest.
