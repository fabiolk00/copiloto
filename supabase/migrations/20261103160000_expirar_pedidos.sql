-- Marca como `expirado` os pedidos Pix que ficaram pendentes e não podem mais
-- ser pagos.
--
-- Por que 1 hora depois do vencimento e não no vencimento: a reconciliação
-- (view `pedidos_a_reconciliar`) ainda confere pendentes por até 1 hora depois
-- de `expires_at`, para pegar um pagamento feito perto do vencimento cujo
-- webhook atrasou. Expirar só depois dessa janela mantém os dois critérios
-- complementares: um pedido pendente está dentro da janela de conferência OU
-- já foi expirado, nunca num meio-termo.
--
-- Rede de segurança: se uma confirmação de pagamento ainda chegar para um
-- pedido `expirado`, o app promove `expirado` -> `pago` (ver markPedidoStatus
-- em lib/pedidos.ts). Pagamento confirmado sempre vence a expiração.
--
-- Pedidos sem `expires_at` (o Pix nunca chegou a ser salvo) usam `created_at`.
-- Só mexe em `pendente`: pago, cancelado, falhou e expirado ficam intactos.
create or replace function public.expirar_pedidos_pendentes()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.pedidos
     set status = 'expirado'
   where status = 'pendente'
     and coalesce(expires_at, created_at) < now() - interval '1 hour';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
