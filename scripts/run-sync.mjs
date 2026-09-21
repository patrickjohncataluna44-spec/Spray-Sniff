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

async function run() {
  const { syncPaymongoOrdersToDatabase } = await import('../lib/paymongo-sync.ts')
  console.log('Running syncPaymongoOrdersToDatabase...')
  const result = await syncPaymongoOrdersToDatabase()
  console.log('Result:', JSON.stringify(result, null, 2))
}

run().catch(console.error)
