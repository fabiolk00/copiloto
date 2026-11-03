-- @supabase-only
-- Agenda a expiração de pedidos pendentes (pg_cron). Ignorado pelo harness de
-- testes (PGlite não tem pg_cron).
--
-- O job nasce DESLIGADO, junto com o de reconciliação: o app com a promoção
-- `expirado` -> `pago` precisa estar no ar antes. Ligue os dois depois do deploy:
--   select cron.alter_job((select jobid from cron.job where jobname = 'expirar-pedidos-pendentes'), active := true);

revoke all on function public.expirar_pedidos_pendentes() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  select cron.schedule('expirar-pedidos-pendentes', '*/5 * * * *', 'select public.expirar_pedidos_pendentes()') into v_jobid;
  perform cron.alter_job(v_jobid, active := false);
end;
$$;
