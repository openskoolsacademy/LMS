import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkCounts() {
  const { count: bulkCount } = await supabase.from('bulk_certificates').select('*', { count: 'exact', head: true })
  const { count: logsCount } = await supabase.from('certificate_logs').select('*', { count: 'exact', head: true })
  
  console.log(`Bulk Certificates count: ${bulkCount}`)
  console.log(`Certificate Logs count: ${logsCount}`)
}

checkCounts()
