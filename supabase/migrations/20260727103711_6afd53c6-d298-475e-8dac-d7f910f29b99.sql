DROP POLICY IF EXISTS approval_queue_insert ON public.approval_queue;
CREATE POLICY approval_queue_insert ON public.approval_queue
FOR INSERT TO authenticated
WITH CHECK (is_org_member(auth.uid(), organization_id) OR is_platform_super_admin(auth.uid()));