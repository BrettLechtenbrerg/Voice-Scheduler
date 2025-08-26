// Database setup script for Voice Scheduler
const { execSync } = require('child_process');

console.log('🚀 Setting up Voice Scheduler database...\n');

try {
  console.log('1. Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('\n2. Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  console.log('\n3. Checking database connection...');
  execSync('npx prisma db pull --print', { stdio: 'inherit' });
  
  console.log('\n✅ Database setup complete!');
  console.log('\nNext steps:');
  console.log('1. Commit and push the changes');
  console.log('2. Test authentication and contact submission');
  
} catch (error) {
  console.error('\n❌ Database setup failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Check if your Supabase database is running');
  console.log('2. Verify DATABASE_URL is correct');
  console.log('3. Check if database has proper permissions');
  
  // Try direct connection test
  console.log('\n🔍 Testing direct connection...');
  try {
    execSync('npx prisma db pull --print --schema=./prisma/schema.prisma', { stdio: 'inherit' });
  } catch (connectError) {
    console.error('Direct connection test failed:', connectError.message);
  }
}