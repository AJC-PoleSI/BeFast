const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// load env vars manually from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=')
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '')
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase config")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearTemplates() {
  console.log("Fetching all templates...")
  const { data: templates, error: fetchError } = await supabase
    .from('document_templates')
    .select('*')

  if (fetchError) {
    console.error("Error fetching templates:", fetchError)
    return
  }

  console.log(`Found ${templates.length} templates. Deleting...`)

  for (const t of templates) {
    if (t.file_path) {
      console.log(`Deleting file from storage: ${t.file_path}`)
      await supabase.storage.from('templates').remove([t.file_path])
    }
    console.log(`Deleting record from DB: ${t.id}`)
    await supabase.from('document_templates').delete().eq('id', t.id)
  }

  console.log("Done clearing templates.")
}

clearTemplates()
