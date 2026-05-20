# Tally Sync

Tally Sync is a middleware platform that connects modern web applications with Tally ERP systems, enabling seamless synchronization of accounting, inventory, customer, and financial data between cloud-based applications and local Tally environments.

It acts as a bridge between businesses using custom web platforms and their existing Tally setup without forcing them to migrate their accounting workflow.

---

# Features

* Real-time data synchronization between web applications and Tally
* Sync invoices, ledgers, vouchers, inventory, and customer records
* Company-level isolation and secure multi-tenant architecture
* Queue-based synchronization for reliability
* Automatic retry handling for failed sync operations
* GST-ready accounting workflows
* Secure API communication
* Offline-safe architecture for local Tally systems
* Easy onboarding for businesses already using Tally
* Unique company mapping and validation system

---

# Tech Stack

## Frontend

* React.js
* Tailwind CSS
* Axios

## Backend

* Node.js
* Express.js
* MongoDB
* REST APIs

## Desktop / Tally Integration

* TDL (Tally Definition Language)
* Local sync agent
* XML-based communication with Tally

## Authentication & Security

* JWT Authentication
* API Key Validation
* Encrypted communication

---

# Architecture Overview

```text
Web Application
       ↓
Backend API Server
       ↓
Queue / Sync Engine
       ↓
Local Tally Sync Agent
       ↓
Tally ERP
```

The backend handles incoming requests, validates company information, and pushes synchronization jobs to the sync engine.

The local sync agent communicates with the Tally ERP instance using XML requests and executes operations like:

* Creating vouchers
* Creating ledgers
* Updating inventory
* Fetching reports
* Verifying company data

---

# Core Problem Solved

Most businesses still rely heavily on Tally for accounting while simultaneously using modern SaaS platforms or custom web applications.

Tally Sync solves the challenge of keeping both systems synchronized without requiring manual data entry.

This allows businesses to:

* Continue using Tally
* Automate accounting workflows
* Reduce human errors
* Save operational time
* Maintain centralized business data

---

# Key Functionalities

## Voucher Synchronization

* Sales vouchers
* Purchase vouchers
* Payment vouchers
* Receipt vouchers
* Journal entries

## Ledger Management

* Create ledgers automatically
* Sync customer/vendor accounts
* Validate existing ledger records

## Inventory Synchronization

* Stock item creation
* Inventory updates
* Quantity synchronization

## Company Verification System

Tally Sync uses company-level verification mechanisms such as:

* Company name validation
* GSTIN matching
* Unique internal company identifiers
* Tally company mapping

This prevents syncing data to the wrong company even when multiple companies have similar names.

---

# Folder Structure

```bash
project-root/
│
├── client/                 # Frontend application
├── server/                 # Backend APIs
├── tally-agent/            # Local Tally sync agent
├── queue-engine/           # Sync processing engine
├── database/               # Database models and configs
├── routes/                 # API routes
├── controllers/            # Business logic
├── services/               # Sync services
├── middleware/             # Authentication & validation
├── utils/                  # Helper utilities
└── README.md
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/tally-sync.git
```

## Install Dependencies

```bash
cd tally-sync
npm install
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
TALLY_HOST=http://localhost:9000
```

---

# Running the Project

## Backend

```bash
npm run server
```

## Frontend

```bash
npm run client
```

## Development Mode

```bash
npm run dev
```

---

# API Example

## Create Voucher

```http
POST /api/v1/vouchers
```

### Request Body

```json
{
  "companyId": "cmp_001",
  "voucherType": "Sales",
  "partyName": "Nikhil Traders",
  "amount": 12000,
  "items": [
    {
      "name": "Product A",
      "quantity": 2,
      "rate": 6000
    }
  ]
}
```

---

# Synchronization Flow

1. User creates data from the web application
2. Backend validates company and payload
3. Sync job gets added to queue
4. Local Tally agent pulls pending jobs
5. Agent converts payload into Tally XML format
6. Tally executes the request
7. Sync status updates back to the server

---

# Reliability Features

* Retry mechanism for failed jobs
* Sync logs and history tracking
* Duplicate request prevention
* Queue-based processing
* Data validation before sync
* Error handling and rollback strategies

---

# Security

* JWT authentication
* API request validation
* Secure company verification
* Token-based sync communication
* Encrypted payload handling

---

# Future Improvements

* WebSocket-based real-time sync
* Advanced reporting dashboard
* Audit trail system
* Role-based access control
* AI-powered accounting insights
* Multi-location business support
* Automated reconciliation

---

# Use Cases

* Accounting SaaS platforms
* ERP integrations
* E-commerce accounting automation
* Inventory management systems
* Business automation tools
* GST billing platforms

---

# Challenges Solved During Development

## Company Mapping

One of the major challenges was ensuring that data syncs to the correct Tally company, especially when businesses had similar company names.

This was solved using:

* Internal unique company identifiers
* GSTIN verification
* Company metadata validation
* Controlled onboarding flow

## Offline Tally Systems

Since Tally often runs locally and may not always be online, a local sync agent and queue-based architecture were implemented to ensure reliable synchronization.

---

# Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to your branch
5. Open a pull request

---

# License

This project is licensed under the MIT License.

---

# Author

Developed by Rishabh Rathore.

Full Stack & Web3 Developer focused on building scalable automation systems and modern business infrastructure.
