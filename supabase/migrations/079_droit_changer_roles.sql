-- 079 — Droit « changer_roles » : changer le rôle de base d'un membre
--
-- Avant : `updateMemberRole` (lib/actions/members.ts) était réservé en dur au
-- rôle de base « administrateur ». Aucun poste ne pouvait donc passer un
-- intervenant en membre AJC (ou l'inverse), et le menu « Changer le rôle »
-- affiché au Pôle RH renvoyait une erreur au clic.
--
-- Le changement de rôle devient la permission `changer_roles`, réglable dans
-- Administration ▸ Droits. Garde-fous applicatifs (canChangeMemberRole) :
-- nommer / retirer un administrateur et changer son propre rôle restent
-- réservés aux administrateurs.
--
-- Accordée par défaut au poste Responsable RH, qui valide déjà les comptes
-- (`valider_comptes`). Données uniquement, aucune modification de schéma.

update public.profils_types
set permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object('changer_roles', true)
where slug = 'responsable_rh';
