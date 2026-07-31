

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role  text NOT NULL,
  scope text NOT NULL,
  UNIQUE (role, scope)
);

INSERT INTO public.role_permissions (role, scope) VALUES
  ('admin', 'dashboard:read'),
  ('admin', 'analytics:read'),
  ('admin', 'users:read'),
  ('admin', 'users:write'),
  ('admin', 'comments:moderate'),
  ('admin', 'rooms:moderate'),
  ('admin', 'watch-party:create-private'),
  ('moderator', 'comments:moderate'),
  ('moderator', 'rooms:moderate'),
  ('premium', 'watch-party:create-private')
ON CONFLICT (role, scope) DO NOTHING;

NOTIFY pgrst, 'reload schema';
