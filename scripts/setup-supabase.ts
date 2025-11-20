/**
 * Interactive Supabase Setup Script
 * Handles local development and cloud deployment configurations
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command: string, silent = false): string {
  try {
    const result = execSync(command, { encoding: 'utf-8' });
    if (!silent) console.log(result);
    return result;
  } catch (error: any) {
    if (!silent) console.error(error.message);
    throw error;
  }
}

function updateEnvFile(key: string, value: string): void {
  const envPath = resolve(process.cwd(), '.env');
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }

  writeFileSync(envPath, envContent);
}

async function checkSupabaseCLI(): Promise<boolean> {
  try {
    execCommand('which supabase', true);
    return true;
  } catch {
    return false;
  }
}

async function setupLocal(): Promise<void> {
  console.log('\n🏠 Setting up local Supabase instance...\n');

  // Check Docker
  try {
    execCommand('docker --version', true);
  } catch {
    console.error('❌ Docker is not installed or not running');
    console.error('📦 Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
    process.exit(1);
  }

  // Initialize Supabase
  console.log('📦 Initializing Supabase project...');
  execCommand('supabase init');

  // Start Supabase
  console.log('🚀 Starting local Supabase instance...');
  execCommand('supabase start');

  // Get connection details
  console.log('\n📊 Getting connection details...');
  const status = execCommand('supabase status', true);

  // Parse connection details
  const apiUrl = status.match(/API URL: (https?:\/\/[^\s]+)/)?.[1];
  const anonKey = status.match(/anon key: ([^\s]+)/)?.[1];
  const serviceKey = status.match(/service_role key: ([^\s]+)/)?.[1];

  if (!apiUrl || !anonKey || !serviceKey) {
    console.error('❌ Failed to parse Supabase connection details');
    process.exit(1);
  }

  // Update .env
  console.log('📝 Updating .env file...');
  updateEnvFile('SUPABASE_URL', apiUrl);
  updateEnvFile('SUPABASE_ANON_KEY', anonKey);
  updateEnvFile('SUPABASE_SERVICE_KEY', serviceKey);

  // Install schema
  console.log('🗃️  Installing database schema...');
  const schemaPath = resolve(process.cwd(), 'database/schema.sql');
  const schemaContent = readFileSync(schemaPath, 'utf-8');

  // Save as migration
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const migrationPath = `supabase/migrations/${timestamp}_initial_schema.sql`;
  writeFileSync(migrationPath, schemaContent);

  execCommand('supabase db reset');

  console.log('\n✅ Local Supabase setup complete!');
  console.log('\n📋 Connection Details:');
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   Anon Key: ${anonKey.substring(0, 20)}...`);
  console.log(`   Service Key: ${serviceKey.substring(0, 20)}...`);
  console.log('\n🔗 Studio URL: http://localhost:54323');
}

async function setupCloud(): Promise<void> {
  console.log('\n☁️  Setting up cloud Supabase connection...\n');

  console.log('📌 You can find your credentials at:');
  console.log('   https://app.supabase.com/project/_/settings/api');
  console.log('');

  // Get credentials from user
  const url = await question('Enter your Supabase URL: ');
  const anonKey = await question('Enter your Anon Key: ');
  const serviceKey = await question('Enter your Service Role Key: ');

  if (!url || !anonKey || !serviceKey) {
    console.error('❌ All credentials are required');
    process.exit(1);
  }

  // Validate URL format
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.error('❌ Invalid Supabase URL format');
    console.error('   Expected: https://your-project.supabase.co');
    process.exit(1);
  }

  // Update .env
  console.log('\n📝 Updating .env file...');
  updateEnvFile('SUPABASE_URL', url);
  updateEnvFile('SUPABASE_ANON_KEY', anonKey);
  updateEnvFile('SUPABASE_SERVICE_KEY', serviceKey);

  // Test connection
  console.log('🔌 Testing connection...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, serviceKey);

    const { data, error } = await supabase.from('_migrations').select('*').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table not found (expected for new projects)
      throw error;
    }

    console.log('✅ Connection successful!');
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Offer to install schema
  const installSchema = await question(
    '\n📥 Install database schema now? (y/n): '
  );

  if (installSchema.toLowerCase() === 'y') {
    console.log('\n🗃️  Installing schema...');
    console.log('📌 Please run the following in your Supabase SQL Editor:');
    console.log(`   https://app.supabase.com/project/_/sql/new`);
    console.log('');
    console.log('   Then paste the contents of: database/schema.sql');
    console.log('');

    const schemaPath = resolve(process.cwd(), 'database/schema.sql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    // Create a temporary SQL file for easy copy
    const tempSqlPath = resolve(process.cwd(), 'temp-schema-to-run.sql');
    writeFileSync(tempSqlPath, schemaContent);

    console.log(`💾 Schema saved to: ${tempSqlPath}`);
    console.log('');

    const completed = await question('Press Enter after running the schema in Supabase SQL Editor...');
  }

  console.log('\n✅ Cloud Supabase setup complete!');
}

async function installSchema(): Promise<void> {
  console.log('\n🗃️  Installing database schema...\n');

  // Check if credentials exist
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    console.error('❌ .env file not found. Run setup first.');
    process.exit(1);
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const hasUrl = /SUPABASE_URL=/m.test(envContent);
  const hasKey = /SUPABASE_SERVICE_KEY=/m.test(envContent);

  if (!hasUrl || !hasKey) {
    console.error('❌ Supabase credentials not found in .env');
    console.error('   Run: npm run setup:supabase');
    process.exit(1);
  }

  console.log('📌 To install the schema:');
  console.log('   1. Go to: https://app.supabase.com/project/_/sql/new');
  console.log('   2. Paste the contents of: database/schema.sql');
  console.log('   3. Click "Run"');
  console.log('');
  console.log('💡 Or use the SQL file at: temp-schema-to-run.sql');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Design Systems MCP - Supabase Setup              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Check if Supabase CLI is installed
  const hasCLI = await checkSupabaseCLI();
  if (!hasCLI) {
    console.log('⚠️  Supabase CLI not found');
    console.log('📦 Install: brew install supabase/tap/supabase');
    console.log('   Or: npm install -g supabase');
    console.log('');
  }

  // Check current setup status
  const envPath = resolve(process.cwd(), '.env');
  const hasEnv = existsSync(envPath);
  const hasSupabaseConfig = existsSync(resolve(process.cwd(), 'supabase/config.toml'));

  if (hasEnv && hasSupabaseConfig) {
    console.log('✅ Supabase appears to be configured');
    const choice = await question(
      '\nWhat would you like to do?\n' +
        '  1) Install/Update Schema\n' +
        '  2) Reconfigure Setup\n' +
        '  3) Exit\n\n' +
        'Choice: '
    );

    if (choice === '1') {
      await installSchema();
    } else if (choice === '2') {
      // Continue to setup
    } else {
      process.exit(0);
    }
  }

  // Setup options
  console.log('\n📦 Choose your setup type:\n');
  console.log('  1) Local Development (Docker)');
  console.log('  2) Cloud Supabase Project');
  console.log('  3) Just Install Schema (already configured)');
  console.log('  4) Exit\n');

  const choice = await question('Choice: ');

  switch (choice) {
    case '1':
      await setupLocal();
      break;
    case '2':
      await setupCloud();
      break;
    case '3':
      await installSchema();
      break;
    case '4':
      console.log('👋 Exiting...');
      process.exit(0);
      break;
    default:
      console.error('❌ Invalid choice');
      process.exit(1);
  }

  // Offer to run validation
  const runValidation = await question(
    '\n🔍 Run validation tests? (y/n): '
  );

  if (runValidation.toLowerCase() === 'y') {
    console.log('\n🧪 Running validation...\n');
    execCommand('npm run validate:ingestion');
  }

  console.log('\n✨ Setup complete!');
  console.log('\n📚 Next steps:');
  console.log('   1. Add design systems content to data/content/');
  console.log('   2. Run: npm run ingest:vectors');
  console.log('   3. Test: npm run test:vector');
  console.log('');

  rl.close();
}

main().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
