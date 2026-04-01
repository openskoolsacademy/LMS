import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkTable() {
  try {
    const { data, error } = await supabase.from('course_reviews').select('*').limit(1)
    if (error) {
      console.log('course_reviews table error:', error.message)
      const { data: data2, error: error2 } = await supabase.from('reviews').select('*').limit(1)
      if (error2) {
        console.log('reviews table error:', error2.message)
      } else {
        console.log('reviews table exists!')
      }
    } else {
      console.log('course_reviews table exists!')
    }
  } catch (err) {
    console.error('Check failed:', err)
  }
}

checkTable()
