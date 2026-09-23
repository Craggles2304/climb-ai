drop policy if exists "feedback_no_client_access" on public.feedback;

create policy "feedback_no_client_access"
on public.feedback
for all
to anon, authenticated
using (false)
with check (false);
