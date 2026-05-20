const mongoose = require('mongoose');
const uri = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection;
    const res = await db.collection('entries').updateMany(
        { }, // Reset EVERYTHING
        { $set: { status: 'pending', syncError: '' } }
    );
    console.log(`Reset ${res.modifiedCount} bills to pending for full re-sync`);
    process.exit(0);
});
