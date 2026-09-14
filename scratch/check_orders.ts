import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local or .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

if (!supabaseUrl) {
  console.log('No supabase URL found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at')
    .gte('created_at', today.toISOString())
    .order('order_number', { ascending: false });

  if (error) {
    console.error('Error', error);
    return;
  }

  let sumCompleted = 0;
  let sumPreparing = 0;
  let countCompleted = 0;
  let countPreparing = 0;
  let countCancelled = 0;

  orders?.forEach(o => {
    const total = typeof o.total === 'string' ? parseFloat(o.total) : o.total;
    if (o.status === 'completed') {
      sumCompleted += total;
      countCompleted++;
    } else if (o.status === 'preparing') {
      sumPreparing += total;
      countPreparing++;
    } else if (o.status === 'cancelled') {
      countCancelled++;
    }
  });

  console.log(`Total orders found today: ${orders?.length}`);
  console.log(`Completed: ${countCompleted} orders, Sum: ${sumCompleted.toFixed(2)} DH`);
  console.log(`Preparing (En attente): ${countPreparing} orders, Sum: ${sumPreparing.toFixed(2)} DH`);
  console.log(`Cancelled: ${countCancelled} orders`);
}

checkOrders();
