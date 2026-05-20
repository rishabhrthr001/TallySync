const mongoose = require('mongoose');
const uri = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection;
    const coll = db.collection('entries');
    await coll.updateOne(
        { invoiceNumber: 'INV-XIAOMI-FINAL-2' },
        { $set: { status: 'pending', syncError: '' } }
    );
    console.log('Reset INV-XIAOMI-FINAL-2 to pending');
    process.exit(0);
});
