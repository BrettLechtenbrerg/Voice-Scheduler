// Generate a secure NEXTAUTH_SECRET
const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('base64');
console.log('\n🔐 Generated NEXTAUTH_SECRET:');
console.log(secret);
console.log('\n📝 Add this to your Vercel environment variables:');
console.log(`NEXTAUTH_SECRET=${secret}`);
console.log('\n✅ Also ensure these are set in Vercel:');
console.log('- NEXTAUTH_URL=https://voice-scheduler-green.vercel.app');
console.log('- DATABASE_URL (your PostgreSQL connection string)');
console.log('- GOOGLE_CLIENT_ID');
console.log('- GOOGLE_CLIENT_SECRET');
console.log('- OPENAI_API_KEY');
console.log('- GHL_WEBHOOK_URL\n');