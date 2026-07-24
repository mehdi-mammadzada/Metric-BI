ALTER TABLE public.kpi_lifecycles
  ALTER COLUMN card_local_id TYPE TEXT USING card_local_id::text;