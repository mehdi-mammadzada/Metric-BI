DROP TRIGGER IF EXISTS dedupe_kpi_set_entries_before_save ON public.org_catalogs;

CREATE OR REPLACE FUNCTION public.dedupe_kpi_set_entries_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.catalog_key = 'kpi_set_entries' THEN
    SELECT COALESCE(jsonb_agg(elem ORDER BY sort_ts DESC), '[]'::jsonb)
    INTO NEW.entries
    FROM (
      SELECT elem, sort_ts
      FROM (
        SELECT
          elem,
          COALESCE(NULLIF(elem->>'updatedAt', '')::numeric, 0) AS sort_ts,
          row_number() OVER (
            PARTITION BY concat(
              COALESCE(elem->>'cardId', ''), '::',
              COALESCE(elem->>'assigneeId', lower(trim(split_part(COALESCE(elem->>'assigneeName', ''), '—', 1)))), '::',
              COALESCE(NULLIF(elem->>'subKpiId', ''), lower(trim(COALESCE(elem->>'subKpiName', '')))), '::',
              COALESCE(elem->>'ownerType', '')
            )
            ORDER BY CASE WHEN elem->>'status' = 'completed' THEN 1 ELSE 0 END DESC,
                     COALESCE(NULLIF(elem->>'updatedAt', '')::numeric, 0) DESC
          ) AS rn
        FROM jsonb_array_elements(COALESCE(NEW.entries, '[]'::jsonb)) elem
      ) ranked
      WHERE rn = 1
    ) kept;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER dedupe_kpi_set_entries_v2_before_save
BEFORE INSERT OR UPDATE ON public.org_catalogs
FOR EACH ROW EXECUTE FUNCTION public.dedupe_kpi_set_entries_v2();