DELETE FROM public.kpi_card_targets t
USING public.kpi_card_targets d
WHERE t.kpi_card_id = d.kpi_card_id
  AND lower(btrim(t.name)) = lower(btrim(d.name))
  AND (t.sort_order, t.created_at, t.id) > (d.sort_order, d.created_at, d.id);