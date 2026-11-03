-- NÃO EXECUTAR sem autorização. Backfill do e-mail do guia para pedidos que
-- já estavam pagos antes do outbox existir.
--
-- 1) Veja a lista primeiro (só leitura):
select id, left(client_token::text, 8) as token, area_slug, trilha, status, email_status
from public.pedidos
where status = 'pago' and email_status is null
order by id;

-- 2) Para enfileirar (depois de revisar a lista e autorizar). Os pedidos de
--    dev/teste (order ORDTST) devem ser excluídos explicitamente na cláusula:
-- update public.pedidos
--    set email_status = 'pendente', email_proxima_tentativa = now()
--  where status = 'pago' and email_status is null
--    and id in (/* ids revisados */);
