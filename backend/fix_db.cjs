
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function fix() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const User = mongoose.model('User', new mongoose.Schema({ email: String, companyName: String }));
    const Entry = mongoose.model('Entry', new mongoose.Schema({ companyName: String, status: String, userId: mongoose.Schema.Types.ObjectId }));

    const pankaj = await User.findOne({ email: 'pankaj@tallySync.com' });
    if (!pankaj) {
        console.error('Pankaj user not found');
        process.exit(1);
    }

    const result = await Entry.updateMany(
        { companyName: 'Nikhil', status: 'pending' },
        { $set: { userId: pankaj._id } }
    );

    console.log(`Updated ${result.modifiedCount} entries to point to Pankaj`);

    process.exit(0);
}

fix().catch(err => {
    console.error(err);
    process.exit(1);
});
