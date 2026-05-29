"use client";

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AutoLogin() {
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("🚀 Tentative de connexion automatique...");
        const { error } = await supabase.auth.signInWithPassword({
          email: process.env.NEXT_PUBLIC_AUTO_LOGIN_EMAIL || 'admin@befast.fr',
          password: process.env.NEXT_PUBLIC_AUTO_LOGIN_PASSWORD || 'BeFast2024!Admin',
        });
        
        if (error) {
          console.error("❌ Échec de la connexion automatique:", error.message);
        } else {
          console.log("✅ Connecté automatiquement en tant qu'administrateur");
          // Recharger pour mettre à jour l'état de l'auth dans les autres composants
          window.location.reload();
        }
      }
    };

    checkUser();
  }, [supabase]);

  return null;
}
