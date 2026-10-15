import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY)

async function backup() {
  console.log('Starting full database backup...')
  const backupData = {
    timestamp: new Date().toISOString(),
    tables: {},
    users: [],
  }

  const tables = [
    'catalog_products',
    'inventory_items',
    'store_orders',
    'store_order_items',
    'order_timeline_entries',
    'pos_transactions',
    'payment_records',
    'stock_movements',
    'support_cases',
    'support_messages',
    'product_reviews',
    'user_carts',
    'user_wishlists',
    'promotions',
    'profiles',
    'app_store_snapshots',
    'public_store_snapshots',
  ]

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.warn(`Error backing up table ${table}:`, error.message)
      backupData.tables[table] = []
    } else {
      backupData.tables[table] = data || []
      console.log(`Backed up ${table}: ${(data || []).length} rows`)
    }
  }

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr) {
    console.warn('Error backing up auth.users:', usersErr.message)
  } else {
    backupData.users = usersData.users || []
    console.log(`Backed up auth.users: ${backupData.users.length} users`)
  }

  const outputPath = 'scripts/backup-before-cleanup.json'
  fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2))
  console.log(`Backup completed successfully and saved to ${outputPath}!`)
}

backup().catch((e) => {
  console.error('Backup failed:', e)
  process.exit(1)
})
