CREATE TABLE public.kpi_card_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  card_ref text NOT NULL,
  author_user_id uuid,
  author_name text NOT NULL DEFAULT 'İstifadəçi',
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kpi_card_comments_card_idx ON public.kpi_card_comments (organization_id, card_ref, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_card_comments TO authenticated;
GRANT ALL ON public.kpi_card_comments TO service_role;
ALTER TABLE public.kpi_card_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read kpi card comments" ON public.kpi_card_comments FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can add kpi card comments" ON public.kpi_card_comments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND author_user_id = auth.uid());
CREATE POLICY "Authors can update own kpi card comments" ON public.kpi_card_comments FOR UPDATE TO authenticated USING (author_user_id = auth.uid()) WITH CHECK (author_user_id = auth.uid());
CREATE POLICY "Authors can delete own kpi card comments" ON public.kpi_card_comments FOR DELETE TO authenticated USING (author_user_id = auth.uid());