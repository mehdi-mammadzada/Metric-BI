INSERT INTO public.permissions (code, module, resource, action, description)
VALUES ('home.ai_assistant', 'home', 'home', 'ai_assistant', 'AI Köməkçi')
ON CONFLICT (code) DO NOTHING;