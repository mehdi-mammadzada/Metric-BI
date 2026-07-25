GRANT SELECT, INSERT, UPDATE ON public.approval_queue TO authenticated;
GRANT ALL ON public.approval_queue TO service_role;

DROP POLICY IF EXISTS approval_queue_update ON public.approval_queue;
CREATE POLICY approval_queue_update ON public.approval_queue
FOR UPDATE TO authenticated
USING (is_org_member(auth.uid(), organization_id) OR is_platform_super_admin(auth.uid()))
WITH CHECK (is_org_member(auth.uid(), organization_id) OR is_platform_super_admin(auth.uid()));