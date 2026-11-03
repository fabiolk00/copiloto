-- Remove a fila de reprocessamento. Nenhum worker a consumia: o webhook agora
-- responde 5xx quando a consulta à Mercado Pago falha (a Mercado Pago
-- reentrega) e a reconciliação por pg_cron cobre notificações perdidas.
drop table if exists public.pedido_webhook_reprocessamentos;
