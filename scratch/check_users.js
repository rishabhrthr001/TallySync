import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  companyName: String,
  name: String
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find({});
    console.log(`Found ${users.length} users:`);
    users.forEach(u => {
      console.log(`- Name: ${u.name}, Email: ${u.email}, Company: ${u.companyName}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkUsers();
