-- @supabase-only
-- O disparo do pg_cron também precisa rodar quando só há e-mail a enviar.
-- Antes, `disparar_reconciliacao_pix()` só chamava o app se existisse Pix a
-- reconciliar; sem isso a fila de e-mail ficaria parada quando não há pedido
-- pendente. O corpo é o mesmo da migration original, com a condição ampliada.

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
  -- Sem trabalho (nem Pix a conferir, nem e-mail a enviar), não chama o app.
  if not exists (select 1 from public.pedidos_a_reconciliar)
     and not exists (select 1 from public.pedidos_email_a_enviar) then
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

revoke all on function public.disparar_reconciliacao_pix() from public, anon, authenticated;
revoke all on public.pedidos_email_a_enviar from anon, authenticated;
