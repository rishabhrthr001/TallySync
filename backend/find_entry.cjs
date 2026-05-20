
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function find() {
    await mongoose.connect(MONGODB_URI);
    const Entry = mongoose.model('Entry', new mongoose.Schema({ totalAmount: Number, invoiceNumber: String, status: String }));
    const e = await Entry.findOne({ totalAmount: { $gt: 0 }, status: 'pending' });
    console.log(JSON.stringify(e, null, 2));
    process.exit(0);
}
find();
