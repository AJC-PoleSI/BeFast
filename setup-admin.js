const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rslztpjwrrjrvajkwcvo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s'
);

(async () => {
  console.log('🚀 BeFast Admin Setup\n');
  console.log('=' .repeat(60));
  
  // Check admin user in auth
  console.log('\n📋 Checking authentication...');
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const adminUser = users?.users?.find(u => u.email === 'admin@befast.fr');
  
  if (!adminUser) {
    console.log('❌ Admin user not found');
    process.exit(1);
  }
  
  console.log('✅ Admin user exists in auth.users');
  console.log('   Email: admin@befast.fr');
  console.log('   ID: ' + adminUser.id);
  console.log('   Confirmed: ' + (adminUser.email_confirmed_at ? 'Yes' : 'No'));
  
  // Try to create profile
  console.log('\n📝 Creating admin profile in personnes table...');
  const { data: profile, error: profileError } = await supabase
    .from('personnes')
    .insert({
      id: adminUser.id,
      email: 'admin@befast.fr',
      prenom: 'Administrateur',
      nom: 'BeFast',
      actif: true
    })
    .select();
  
  if (profileError) {
    console.log('❌ Table might not exist yet:', profileError.message);
    console.log('\n⚠️  Next step: Go to Supabase Dashboard SQL Editor');
    console.log('    → Execute the migrations manually:');
    console.log('    → /Users/felixpitz/Desktop/Befast/supabase/migrations/001_init_schema.sql');
    console.log('    → Then run this script again\n');
  } else {
    console.log('✅ Profile created');
    
    // Now assign admin role
    console.log('\n🔑 Assigning Administrateur role...');
    
    // First get the admin role ID
    const { data: roles, error: rolesError } = await supabase
      .from('profils_types')
      .select('id')
      .eq('slug', 'administrateur')
      .single();
    
    if (rolesError) {
      console.log('❌ Could not find administrateur role:', rolesError.message);
    } else {
      const { error: updateError } = await supabase
        .from('personnes')
        .update({ profil_type_id: roles.id })
        .eq('id', adminUser.id);
      
      if (updateError) {
        console.log('❌ Failed to assign role:', updateError.message);
      } else {
        console.log('✅ Role assigned');
      }
    }
  }
  
  // Print credentials
  console.log('\n' + '='.repeat(60));
  console.log('\n📱 LOGIN CREDENTIALS:');
  console.log('   Email: admin@befast.fr');
  console.log('   Password: BeFast2024!Admin');
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Setup complete!\n');
})().catch(e => {
  console.error('💥 ERROR:', e.message);
  console.error(e);
  process.exit(1);
});
