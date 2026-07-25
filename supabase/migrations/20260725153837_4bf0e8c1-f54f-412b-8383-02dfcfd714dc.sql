CREATE OR REPLACE FUNCTION public.sync_kpi_card_status_from_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_status text;
  reason text;
  is_deletion boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = OLD.status
     AND NEW.decisions IS NOT DISTINCT FROM OLD.decisions
  THEN
    RETURN NEW;
  END IF;

  is_deletion := COALESCE(NEW.matrix_local_id, '') LIKE 'deletion:%';

  IF NEW.status = 'approved' THEN
    target_status := CASE WHEN is_deletion THEN 'silindi' ELSE 'aktiv' END;
  ELSIF NEW.status = 'rejected' THEN
    IF is_deletion THEN
      RETURN NEW;
    END IF;

    target_status := 'imtina';
    BEGIN
      SELECT COALESCE(
        (SELECT value->>'note' FROM jsonb_each(NEW.decisions) WHERE value->>'decision' = 'rejected' LIMIT 1),
        (SELECT value->>'comment' FROM jsonb_each(NEW.decisions) WHERE value->>'decision' = 'rejected' LIMIT 1),
        'İmtina edildi'
      ) INTO reason;
    EXCEPTION WHEN OTHERS THEN
      reason := 'İmtina edildi';
    END;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.kpi_cards
  SET status = target_status,
      rejected_reason = CASE WHEN target_status = 'imtina' THEN reason ELSE NULL END,
      rejected_by = CASE WHEN target_status = 'imtina' THEN (
        SELECT key FROM jsonb_each(NEW.decisions) WHERE value->>'decision' = 'rejected' LIMIT 1
      ) ELSE NULL END,
      rejected_at = CASE WHEN target_status = 'imtina' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE organization_id = NEW.organization_id
    AND (
      id::text = NEW.kpi_card_local_id
      OR legacy_numeric_id::text = NEW.kpi_card_local_id
      OR ('kpi-' || legacy_numeric_id::text) = NEW.kpi_card_local_id
    );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_kpi_card_status_from_approval() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_kpi_card_status_from_approval() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_kpi_card_status_from_approval ON public.approval_queue;
DROP TRIGGER IF EXISTS trg_sync_kpi_card_status ON public.approval_queue;
CREATE TRIGGER trg_sync_kpi_card_status_from_approval
AFTER INSERT OR UPDATE OF status, decisions ON public.approval_queue
FOR EACH ROW
EXECUTE FUNCTION public.sync_kpi_card_status_from_approval();

UPDATE public.kpi_cards kc
SET status = 'silindi',
    rejected_reason = NULL,
    rejected_by = NULL,
    rejected_at = NULL,
    updated_at = now()
FROM public.approval_queue aq
WHERE aq.organization_id = kc.organization_id
  AND aq.status = 'approved'
  AND COALESCE(aq.matrix_local_id, '') LIKE 'deletion:%'
  AND (
    kc.id::text = aq.kpi_card_local_id
    OR kc.legacy_numeric_id::text = aq.kpi_card_local_id
    OR ('kpi-' || kc.legacy_numeric_id::text) = aq.kpi_card_local_id
  );