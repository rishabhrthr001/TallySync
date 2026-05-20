# TallySync Local Agent

This agent bridges your TallySync website (Cloud) with your local Tally software.

## 🚀 Setup Instructions

1. **Install Node.js**: Make sure Node.js is installed on your computer.
2. **Copy Files**: Copy `agent.js` and `package.json` to a folder on your computer.
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Configure**: Open `agent.js` and edit the `CONFIG` section at the top:
   - `BACKEND_URL`: Your website URL (e.g., `https://your-tallysync-app.com`)
   - `EMAIL`: Your login email.
   - `PASSWORD`: Your login password.
5. **Prepare Tally**:
   - Open Tally.
   - Go to **F12: Configure** > **Advanced Configuration**.
   - Set **Enable ODBC Services** to `Yes`.
   - Set **Port** to `9000`.
   - Set **Accept External HTTP Requests** to `Yes`.
6. **Run the Agent**:
   ```bash
   node agent.js
   ```

## 🛠️ How it works
- The agent logs in to your website and gets a secure token.
- It asks the website for any "Pending" bills every 10 seconds.
- It converts the bill into Tally XML format.
- It sends the XML to Tally (http://localhost:9000).
- It reports back to the website if the sync was successful or if there was an error.
