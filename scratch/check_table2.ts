import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// read .env
const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  try {
    envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
  } catch (e) {
    console.error('Could not find .env');
    process.exit(1);
  }
}

const envVars = envContent.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  }
  return acc;
}, {} as Record<string, string>);

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing supabase url or key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tables } = await supabase.from('tables').select('*');
  console.log('Tables:', tables);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name, base_price))')
    .eq('status', 'preparing')
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('Orders error:', ordersError);
    return;
  }

  const table2Orders = orders.filter(o => o.table_id === '2' || (tables?.find(t => t.id === o.table_id)?.table_number === 2));
  
  console.log('Active Orders for Table 2:');
  console.log(JSON.stringify(table2Orders, null, 2));
}

check();
