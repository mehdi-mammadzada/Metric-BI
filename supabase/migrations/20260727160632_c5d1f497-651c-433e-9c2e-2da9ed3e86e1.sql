ALTER TABLE public.kpi_cards
ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'individual';

ALTER TABLE public.kpi_cards
DROP CONSTRAINT IF EXISTS kpi_cards_assignment_mode_check;

ALTER TABLE public.kpi_cards
ADD CONSTRAINT kpi_cards_assignment_mode_check
CHECK (assignment_mode IN ('individual', 'bulk'));

UPDATE public.kpi_cards
SET assignment_mode = CASE
  WHEN COALESCE(array_length(team_ids, 1), 0) > 0
    OR COALESCE(array_length(structure_ids, 1), 0) > 0
    OR COALESCE(array_length(assignee_ids, 1), 0) > 1
  THEN 'bulk'
  ELSE 'individual'
END
WHERE assignment_mode IS NULL
   OR assignment_mode NOT IN ('individual', 'bulk');

UPDATE public.kpi_cards
SET assignment_mode = 'bulk'
WHERE lower(name) LIKE '%toplu%';