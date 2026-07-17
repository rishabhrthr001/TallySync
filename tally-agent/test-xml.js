const { generateInventoryVoucherXML, generateAccountingVoucherXML } = require('./agent.js');

const entry = {
  "_id": "6a00590a1b9085c4b907d391",
  "userId": "69eb5201d77253e799d63e96",
  "companyName": "Nikhil",
  "type": "sales",
  "partyName": "samsung",
  "partyGstin": "",
  "invoiceNumber": "INV-4081",
  "date": "2026-05-10",
  "items": [
    {
      "name": "Software Services",
      "quantity": 1,
      "rate": 20000,
      "amount": 20000,
      "_id": "6a00590a1b9085c4b907d392"
    },
    {
      "name": "Software Services",
      "quantity": 10,
      "rate": 20000,
      "amount": 200000,
      "_id": "6a00590a1b9085c4b907d393"
    }
  ],
  "taxableAmount": 220000,
  "taxAmount": 39600,
  "totalAmount": 259600,
  "status": "success",
  "idempotencyKey": "sales-INV-4081-1778407690258",
  "notes": "",
  "syncError": "Accounting voucher creation failed",
  "createdAt": "2026-05-10T10:08:10.306Z",
  "__v": 0
};

console.log("--- INVENTORY VOUCHER ---");
console.log(generateInventoryVoucherXML(entry, "samsung", "Sales Accounts", "GST Tax"));
console.log("\n--- ACCOUNTING VOUCHER ---");
console.log(generateAccountingVoucherXML(entry, "samsung", "Sales Accounts", "GST Tax"));
