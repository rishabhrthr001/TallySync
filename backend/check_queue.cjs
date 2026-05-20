
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function check() {
    await mongoose.connect(MONGODB_URI);
    const Entry = mongoose.model('Entry', new mongoose.Schema({ totalAmount: Number, status: String, invoiceNumber: String }));
    const result = await Entry.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
    ]);
    console.log(result);
    process.exit(0);
}
check();
