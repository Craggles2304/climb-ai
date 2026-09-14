-- Trigger-only SECURITY DEFINER function: it should not be callable over RPC.
revoke execute on function public.op_link_recent_pregame_to_session() from public, anon, authenticated;
