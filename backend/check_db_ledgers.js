import mongoose from 'mongoose';

const uri = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection;
    const ledgers = await db.collection('ledgers').find({ companyName: 'Rishabh Enterprises' }).toArray();
    console.log(`Found ${ledgers.length} ledgers for "Rishabh Enterprises":`);
    console.log(ledgers.map(l => ({ partyName: l.partyName, balance: l.balance })));
    process.exit(0);
});
