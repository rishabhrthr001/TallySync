const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function clean() {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const db = mongoose.connection;

    // 1. Delete all entries
    console.log('Clearing entries collection...');
    const entryRes = await db.collection('entries').deleteMany({});
    console.log(`Deleted ${entryRes.deletedCount} entries.`);

    // 2. Delete all items
    console.log('Clearing items collection...');
    const itemRes = await db.collection('items').deleteMany({});
    console.log(`Deleted ${itemRes.deletedCount} items.`);

    // 3. Delete all ledgers
    console.log('Clearing ledgers collection...');
    const ledgerRes = await db.collection('ledgers').deleteMany({});
    console.log(`Deleted ${ledgerRes.deletedCount} ledgers.`);

    // 4. Delete all users except pankaj@photoBill.com
    console.log('Clearing non-admin users...');
    const userRes = await db.collection('users').deleteMany({
        email: { $ne: 'pankaj@photoBill.com' }
    });
    console.log(`Deleted ${userRes.deletedCount} users.`);

    // 5. Verify the state of the remaining admin user
    const adminUser = await db.collection('users').findOne({ email: 'pankaj@photoBill.com' });
    if (adminUser) {
        console.log('Admin user found in database:', {
            id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
            role: adminUser.role,
            companyName: adminUser.companyName
        });
    } else {
        console.log('WARNING: Admin user (pankaj@photoBill.com) not found in database. It will be seeded on backend start.');
    }

    console.log('Database cleanup completed successfully.');
    process.exit(0);
}

clean().catch(err => {
    console.error('Error during database cleanup:', err);
    process.exit(1);
});
