#!/usr/bin/env node

/**
 * Create test users in Supabase Auth
 * Usage: node setup-test-users.js
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdlgiymtvxeayadjjnsj.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('Get it from: Supabase Dashboard → Project Settings → API → Service Role Key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const testUsers = [
  {
    email: 'test.partner.wakad@kair.app',
    password: 'Test@123',
    role: 'channel_partner',
    name: 'Wakad Collection Point'
  },
  {
    email: 'test.batchrider@kair.app',
    password: 'Test@123',
    role: 'batch_rider',
    name: 'Raj Singh (Van Driver)'
  }
];

async function createTestUsers() {
  console.log('🔧 Creating test users in Supabase Auth...\n');

  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          role: user.role
        }
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${user.email} — Already exists`);
        } else {
          console.error(`❌ ${user.email} — Error: ${error.message}`);
        }
      } else {
        console.log(`✅ ${user.email} (${user.role})`);
        console.log(`   Password: ${user.password}`);
      }
    } catch (err) {
      console.error(`❌ ${user.email} — ${err.message}`);
    }
  }

  console.log('\n✨ Setup complete!');
  console.log('\nTest credentials:');
  console.log('─────────────────────────────────────────');
  testUsers.forEach(u => {
    console.log(`\n${u.role.toUpperCase()}`);
    console.log(`Email:    ${u.email}`);
    console.log(`Password: ${u.password}`);
  });
}

createTestUsers();
