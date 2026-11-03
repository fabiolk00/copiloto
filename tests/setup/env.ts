// Executa antes de qualquer arquivo de teste importar `@/lib/env` — que faz
// `envSchema.parse` no carregamento do módulo e lança se algo obrigatório
// faltar. Os testes de integração substituem `@/lib/db` por um Postgres de
// teste (ver tests/helpers/test-db.ts); DATABASE_URL aqui só precisa
// satisfazer o schema, nunca é realmente usado para conectar.
process.env.MP_ACCESS_TOKEN ??= "TEST-access-token";
process.env.MP_WEBHOOK_SECRET ??= "test-webhook-secret";
process.env.MP_PIX_EXPIRATION ??= "PT30M";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:5432/unused";
process.env.APP_URL ??= "http://localhost:3000";
