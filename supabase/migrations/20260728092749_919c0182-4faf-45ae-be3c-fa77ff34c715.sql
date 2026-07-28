ALTER TABLE public.kpi_card_targets
  ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_descriptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluator JSONB,
  ADD COLUMN IF NOT EXISTS ranges JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.kpi_cards
  ADD COLUMN IF NOT EXISTS position_ids TEXT[] NOT NULL DEFAULT '{}';