const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const uri = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection;
    const coll = db.collection('entries');
    
    const newEntry = {
        userId: new ObjectId('69dcca86c49c74645f36ee91'), // Pankaj Admin
        companyName: 'Nikhil',
        type: 'sales',
        partyName: 'GoluBKL',
        partyGstin: '',
        invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000),
        date: '2026-05-10',
        items: [
            {
                name: 'Software Services',
                quantity: 2,
                rate: 1500,
                amount: 3000,
                _id: new ObjectId()
            }
        ],
        taxableAmount: 3000,
        taxAmount: 540,
        totalAmount: 3540,
        status: 'pending',
        idempotencyKey: 'sales-GoluBKL-' + Date.now(),
        notes: 'Test entry for GoluBKL',
        createdAt: new Date(),
        __v: 0
    };

    const res = await coll.insertOne(newEntry);
    console.log(`Created new bill for GoluBKL: ${newEntry.invoiceNumber}`);
    process.exit(0);
});
