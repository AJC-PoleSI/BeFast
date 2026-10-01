-- ════════════════════════════════════════════════════════════════════════
-- 058 — Recrée le trigger handle_new_user (au cas où il aurait disparu en
-- prod) et répare rétroactivement les comptes auth.users qui n'ont pas de
-- ligne personnes correspondante (ex: adrien.dossantos@audencia.com, coincé
-- dans un état "email pris côté Auth mais invisible côté appli").
-- Idempotent — peut être rejoué sans risque.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Recrée la fonction (identique à 020_fix_new_user_status.sql).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id FROM public.profils_types WHERE slug = 'intervenant';

  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.profils_types WHERE est_defaut = true LIMIT 1;
  END IF;

  INSERT INTO public.personnes (id, email, prenom, nom, profil_type_id, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    default_role_id,
    'pending_validation'
  )
  ON CONFLICT (id) DO NOTHING; -- sécurité si la ligne existe déjà
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recrée le trigger (au cas où il aurait été supprimé ou jamais créé en prod).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill : répare tout compte auth.users existant sans ligne personnes
--    (récupère Adrien + tout autre candidat coincé dans le même état).
INSERT INTO public.personnes (id, email, prenom, nom, profil_type_id, account_status)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'prenom', ''),
  COALESCE(au.raw_user_meta_data->>'nom', ''),
  COALESCE(
    (SELECT id FROM public.profils_types WHERE slug = 'intervenant'),
    (SELECT id FROM public.profils_types WHERE est_defaut = true LIMIT 1)
  ),
  'pending_validation'
FROM auth.users au
LEFT JOIN public.personnes p ON p.id = au.id
WHERE p.id IS NULL;

NOTIFY pgrst, 'reload schema';

-- ── Vérification manuelle après exécution ─────────────────────────────
-- SELECT id, email, account_status FROM public.personnes
--   WHERE email = 'adrien.dossantos@audencia.com';
-- → doit maintenant renvoyer une ligne.
