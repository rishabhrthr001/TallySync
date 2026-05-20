
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function reset() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const Entry = mongoose.model('Entry', new mongoose.Schema({ status: String }));

    const result = await Entry.updateMany(
        { status: 'failed' },
        { $set: { status: 'pending', syncError: '' } }
    );

    console.log(`Reset ${result.modifiedCount} entries to pending`);

    process.exit(0);
}

reset().catch(err => {
    console.error(err);
    process.exit(1);
});
