const mongoose = require('mongoose');
const uri = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection;
    await db.collection('users').updateMany({}, { $set: { companyName: 'Nikhil' } });
    const res = await db.collection('entries').updateMany(
        { status: 'failed' },
        { $set: { companyName: 'Nikhil', status: 'pending', syncError: '' } }
    );
    console.log(`Final fix: Updated users and reset ${res.modifiedCount} entries to pending`);
    process.exit(0);
});
