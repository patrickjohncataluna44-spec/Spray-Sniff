import fs from 'fs'

const envText = fs.readFileSync('.env', 'utf-8')
const envConfig = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=')
      const k = l.slice(0, idx).trim()
      let v = l.slice(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return [k, v]
    }),
)

for (const [k, v] of Object.entries(envConfig)) {
  if (!process.env[k]) {
    process.env[k] = v
  }
}

async function testActor(email) {
  const { loadBootstrapStoreStateForActor } = await import('../lib/store-persistence.ts')
  const { createSupabaseAdminClient } = await import('../lib/supabase-server.ts')
  const supabase = createSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle()

  const actor = {
    id: profile?.id || 'anon-id',
    email,
    role: profile?.role || 'USER',
    name: profile?.name || email,
  }

  const result = await loadBootstrapStoreStateForActor(actor)
  console.log(`\n=== Orders for ${email} (Profile ID: ${profile?.id}, Role: ${actor.role}) ===`)
  console.log(`Found ${result.orders.length} order(s):`)
  for (const o of result.orders) {
    console.log(`- ${o.id} | Status: ${o.status} | Total: ₱${o.total} | Method: ${o.paymentMethod} | Status: ${o.paymentStatus} | Email: ${o.customerEmail}`)
  }
}

async function run() {
  await testActor('micelpiralta@gmail.com')
  await testActor('peraltamichellejane5@gmail.com')
  await testActor('troytrebajo123@gmail.com')
  await testActor('gwynethctln@gmail.com')
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
