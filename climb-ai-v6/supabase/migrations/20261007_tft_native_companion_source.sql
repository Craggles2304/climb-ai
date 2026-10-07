alter table if exists public.tft_telemetry_sessions
  drop constraint if exists tft_telemetry_sessions_source_check;

alter table if exists public.tft_telemetry_sessions
  add constraint tft_telemetry_sessions_source_check
  check (source in ('OP_CLIMB_NATIVE','OVERWOLF_GEP','IMPORTED_JSON'));

alter table if exists public.tft_telemetry_sessions
  alter column source set default 'OP_CLIMB_NATIVE';
