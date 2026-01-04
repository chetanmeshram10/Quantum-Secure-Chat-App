require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function testConnection() {
  console.log('🔍 Testing MongoDB Atlas connection...\n');
  console.log('📡 Using connection string from .env.local');
  console.log('🔒 Connection string (masked):', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
  
  try {
    console.log('\n⏳ Attempting to connect (30 second timeout)...\n');
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ ✅ ✅ SUCCESS! Connected to MongoDB Atlas! ✅ ✅ ✅\n');
    
    const db = mongoose.connection.db;
    console.log('📚 Database name:', db.databaseName);
    
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:', collections.length > 0 ? collections.map(c => c.name).join(', ') : 'No collections yet (this is normal for a new database)');
    
    // Test creating a collection
    console.log('\n🧪 Testing write permissions...');
    await db.collection('test').insertOne({ test: true, timestamp: new Date() });
    console.log('✅ Write test successful!');
    
    // Clean up
    await db.collection('test').deleteOne({ test: true });
    console.log('✅ Cleanup successful!');
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed successfully.\n');
    console.log('🎉 Your MongoDB connection is working perfectly!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ❌ ❌ CONNECTION FAILED! ❌ ❌ ❌\n');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    
    console.error('\n🔍 Debugging Information:');
    console.error('   - MONGODB_URI exists:', !!MONGODB_URI);
    console.error('   - MONGODB_URI length:', MONGODB_URI ? MONGODB_URI.length : 0);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n❌ AUTHENTICATION ERROR:');
      console.error('   → Username or password is incorrect');
      console.error('   → Go to MongoDB Atlas → Database Access');
      console.error('   → Create a new user: chatappuser / ChatApp2024');
    } else if (error.message.includes('IP')) {
      console.error('\n❌ NETWORK ERROR:');
      console.error('   → Wait 3-5 minutes after adding IP to whitelist');
      console.error('   → Current IPs whitelisted: Check Network Access tab');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n❌ DNS/NETWORK ERROR:');
      console.error('   → Check your internet connection');
      console.error('   → Try disabling VPN if you have one');
      console.error('   → Verify cluster URL is correct');
    }
    
    console.error('\n📋 Full Error Details:');
    console.error(error);
    process.exit(1);
  }
}

console.log('🚀 Starting MongoDB Connection Test...\n');
testConnection();