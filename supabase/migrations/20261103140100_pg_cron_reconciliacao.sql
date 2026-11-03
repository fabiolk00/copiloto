-- @supabase-only
-- Agendamento da reconciliação com pg_cron + pg_net. Específico do Supabase:
-- o harness de testes (PGlite) não tem essas extensões e ignora este arquivo
-- (ver tests/helpers/test-db.ts).
--
-- Fluxo: a cada minuto o pg_cron chama `disparar_reconciliacao_pix()`. Se
-- existir pedido a conferir, ela faz um POST (pg_net) na rota interna do app,
-- que consulta a Mercado Pago e aplica a mesma regra de status do webhook.
--
-- A URL e o segredo ficam no Vault (nunca neste arquivo nem no git):
--   vault secret `reconcile_url`    -> URL completa da rota interna
--   vault secret `reconcile_secret` -> mesmo valor de RECONCILE_SECRET no app

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.disparar_reconciliacao_pix()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  -- Sem trabalho, não chama o app.
  if not exists (select 1 from public.pedidos_a_reconciliar) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reconcile_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reconcile_secret';

  if v_url is null or v_secret is null then
    raise warning 'reconciliacao Pix: reconcile_url ou reconcile_secret ausente no Vault';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 8000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- Só o dono (e o pg_cron, que roda como dono) executa; nunca via API pública.
revoke all on function public.disparar_reconciliacao_pix() from public, anon, authenticated;
revoke all on public.pedidos_a_reconciliar from anon, authenticated;

-- Job de reconciliação: criado DESLIGADO. Ligue só depois de o app com a rota
-- interna estar no ar e de `RECONCILE_SECRET` estar definido no deploy:
--   select cron.alter_job((select jobid from cron.job where jobname = 'reconciliar-pix'), active := true);
do $$
declare
  v_jobid bigint;
begin
  select cron.schedule('reconciliar-pix', '* * * * *', 'select public.disparar_reconciliacao_pix()') into v_jobid;
  perform cron.alter_job(v_jobid, active := false);
end;
$$;

-- Manutenção: descarta eventos de webhook com mais de 30 dias (diário, 03:15 UTC).
select cron.schedule(
  'limpar-webhook-eventos',
  '15 3 * * *',
  $$delete from public.pedido_webhook_eventos where received_at < now() - interval '30 days'$$
);
