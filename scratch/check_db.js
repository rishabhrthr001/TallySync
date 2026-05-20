
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function check() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const User = mongoose.model('User', new mongoose.Schema({ email: String, companyName: String, role: String }));
    const Entry = mongoose.model('Entry', new mongoose.Schema({ companyName: String, status: String, userId: mongoose.Schema.Types.ObjectId }));

    const user = await User.findOne({ email: 'pankaj@tallySync.com' });
    console.log('Agent User:', user);

    const pendingEntries = await Entry.find({ status: 'pending' });
    console.log('Total Pending Entries:', pendingEntries.length);
    
    if (pendingEntries.length > 0) {
        console.log('First few pending entries:');
        pendingEntries.slice(0, 5).forEach(e => {
            console.log(`ID: ${e._id}, Company: "${e.companyName}"`);
        });
    }

    const allUsers = await User.find({});
    console.log('\nAll Users and their companies:');
    allUsers.forEach(u => console.log(`- ${u.email} (${u.role}): "${u.companyName}"`));

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
