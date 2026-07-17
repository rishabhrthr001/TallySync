const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://rishabhrthr001:dhsajlhdiu2163791yhdeqkld@ac-ehbc77y-shard-00-00.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-01.gobl2ud.mongodb.net:27017,ac-ehbc77y-shard-00-02.gobl2ud.mongodb.net:27017/tallysync?ssl=true&replicaSet=atlas-116th2-shard-0&authSource=admin';

async function check() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const ItemSchema = new mongoose.Schema({}, { strict: false });
    const Item = mongoose.model('Item', ItemSchema);

    const items = await Item.find({});
    console.log(`Total items in Item collection: ${items.length}`);
    items.forEach(item => {
        console.log(`- ID: ${item._id}, Name: "${item.name}", Company: "${item.companyName}", SKU: "${item.sku || ''}"`);
    });

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
