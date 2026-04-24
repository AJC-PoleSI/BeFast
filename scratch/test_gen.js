const fs = require('fs')

async function testGen() {
  const envFile = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=')
    if (key && value.length > 0) {
      env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '')
    }
  })

  // get a template ID and mission ID
  const { createClient } = require('@supabase/supabase-js')
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: tpls } = await supabase.from('document_templates').select('id, category')
  if (!tpls || tpls.length === 0) {
      console.log("No templates found.")
      return
  }
  const tpl = tpls[0]

  const { data: missions } = await supabase.from('missions').select('id')
  if (!missions || missions.length === 0) {
      console.log("No missions found.")
      return
  }
  const mission = missions[0]

  console.log(`Testing with template ${tpl.id} and mission ${mission.id}`)

  // call local API
  const res = await fetch("http://localhost:3000/api/documents/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: tpl.id,
      scope: "mission",
      entity_id: mission.id
    })
  })
  
  if (!res.ok) {
    const text = await res.text()
    console.error("Failed:", res.status, text)
  } else {
    const json = await res.json()
    console.log("Success:", json)
  }
}

testGen()
