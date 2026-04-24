const fs = require('fs')

async function checkSchema() {
  const envFile = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=')
    if (key && value.length > 0) {
      env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '')
    }
  })

  const { createClient } = require('@supabase/supabase-js')
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']
  const supabase = createClient(supabaseUrl, supabaseKey)

  // fetch one row from personnes
  const { data, error } = await supabase.from('personnes').select('*').limit(1)
  if (error) {
    console.error("Error fetching personnes:", error)
  } else {
    if (data.length > 0) {
      console.log("Columns in personnes:")
      console.log(Object.keys(data[0]).sort())
    } else {
      console.log("No data in personnes, cannot infer columns this way. Using postgres info.")
    }
  }

  // To be robust, let's just do a direct API check by trying to update a fake ID
  const testCols = ["prenom", "nom", "portable", "promo", "adresse", "ville", "code_postal", "pole", "etablissement", "scolarite", "date_naissance"]
  for (const col of testCols) {
    const { error: e } = await supabase.from('personnes').update({ [col]: null }).eq('id', '00000000-0000-0000-0000-000000000000')
    if (e) {
      console.error(`Column ${col} error:`, e.message)
    } else {
      console.log(`Column ${col} OK`)
    }
  }
}

checkSchema()
