require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsers() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('discord_user_id, username')
      .limit(5);
    
    if (error) throw error;
    
    console.log('Imported users:');
    data.forEach(msg => {
      console.log(`- ${msg.username}: ${msg.discord_user_id}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();
