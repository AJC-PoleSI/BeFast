-- RLS Policies for Encrypted Data Access

-- Policy: Allow users to read their own encrypted data
CREATE POLICY "users_can_read_own_encrypted_data"
  ON personnes
  FOR SELECT
  USING (
    id = auth.uid()
    OR -- Manager can read their team members' encrypted data
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'manager'
        )
      )
      AND -- Check if current user is a manager of this person
      EXISTS (
        SELECT 1 FROM equipes
        WHERE manager_id = auth.uid()
        AND membre_id = personnes.id
      )
    )
    OR -- Admin can read all encrypted data
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );

-- Policy: Allow users to update their own encrypted data
CREATE POLICY "users_can_update_own_encrypted_data"
  ON personnes
  FOR UPDATE
  USING (
    id = auth.uid()
    OR -- Admin can update any encrypted data
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );

-- Policy: Allow users to read their own etude encrypted data
CREATE POLICY "users_can_read_own_etude_encrypted_data"
  ON etudes
  FOR SELECT
  USING (
    suiveur_id = auth.uid()
    OR -- Manager can read their team's etudes
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'manager'
        )
      )
      AND -- Check if current user is a manager of the etude suiveur
      EXISTS (
        SELECT 1 FROM equipes
        WHERE manager_id = auth.uid()
        AND membre_id = etudes.suiveur_id
      )
    )
    OR -- Admin can read all etudes
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );

-- Policy: Allow users to update their own etude encrypted data
CREATE POLICY "users_can_update_own_etude_encrypted_data"
  ON etudes
  FOR UPDATE
  USING (
    suiveur_id = auth.uid()
    OR -- Admin can update any etude
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );

-- Policy: Allow users to read their own mission encrypted data
CREATE POLICY "users_can_read_own_mission_encrypted_data"
  ON missions
  FOR SELECT
  USING (
    -- Can read if you're an intervenant on the mission
    id IN (
      SELECT mission_id FROM mission_intervenants
      WHERE personne_id = auth.uid()
    )
    OR -- Can read if you're the etude suiveur
    (
      SELECT suiveur_id FROM etudes
      WHERE etudes.id = missions.etude_id
    ) = auth.uid()
    OR -- Manager can read their team's missions
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'manager'
        )
      )
      AND -- Check if current user is a manager of mission intervenants
      EXISTS (
        SELECT 1 FROM mission_intervenants mi
        JOIN equipes e ON mi.personne_id = e.membre_id
        WHERE mi.mission_id = missions.id
        AND e.manager_id = auth.uid()
      )
    )
    OR -- Admin can read all missions
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );

-- Policy: Allow users to update their own mission encrypted data
CREATE POLICY "users_can_update_own_mission_encrypted_data"
  ON missions
  FOR UPDATE
  USING (
    -- Etude suiveur can update
    (
      SELECT suiveur_id FROM etudes
      WHERE etudes.id = missions.etude_id
    ) = auth.uid()
    OR -- Admin can update any mission
    (
      EXISTS (
        SELECT 1 FROM personnes p
        WHERE p.id = auth.uid()
        AND p.profil_type_id IN (
          SELECT id FROM profils_types WHERE slug = 'administrateur'
        )
      )
    )
  );
