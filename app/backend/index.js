const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the frontend build directory
app.use(express.static(path.join(__dirname, '../frontend-dist')));

const PORT = process.env.PORT || 3001;

let db;
const fs = require('fs').promises;

let backendLogs = [];
function addLog(message, details = null) {
    backendLogs.push({ time: new Date().toISOString(), message, details });
    console.log(message);
}

// Function to fetch DB password from Thales CSM (Akeyless) using K8s Auth
async function getDbPassword() {
    addLog("Fetching DB password via Kubernetes-native authentication...");
    try {
        // 1. Read the K8s ServiceAccount JWT token
        const k8sTokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
        let k8sToken;
        
        try {
            k8sToken = await fs.readFile(k8sTokenPath, 'utf8');
            addLog("Read K8s ServiceAccount JWT Token", { path: k8sTokenPath, tokenLength: k8sToken.length });
        } catch (e) {
            addLog("K8s token not found at path. Falling back to static password for local testing.", { path: k8sTokenPath });
            return process.env.DB_PASSWORD || 'temppass';
        }

        const csmUrl = process.env.CSM_URL || 'https://api.akeyless.io';
        const accessId = process.env.CSM_ACCESS_ID || 'dummy-access-id';
        const authConfigName = process.env.CSM_K8S_AUTH_CONFIG || 'k8s-auth-config';

        addLog("Authenticating with CSM using K8s JWT...", { 
            endpoint: `${csmUrl}/auth`, 
            payload: { 'access-id': accessId, 'k8s-service-account-token': '[REDACTED_JWT]', 'k8s-auth-config-name': authConfigName }
        });

        // LIVE INTEGRATION: Authenticate
        const authResponse = await axios.post(`${csmUrl}/auth`, {
            'access-id': accessId,
            'k8s-service-account-token': k8sToken,
            'k8s-auth-config-name': authConfigName
        });
        const csmToken = authResponse.data.token;

        const secretPath = process.env.CSM_DB_PASSWORD_PATH || '/secrets/mysql-pass';
        addLog("Fetching DB secret from CSM...", { 
            endpoint: `${csmUrl}/get-secret-value`, 
            payload: { 'names': [secretPath] }
        });

        // LIVE INTEGRATION: Fetch Secret
        const secretResponse = await axios.post(`${csmUrl}/get-secret-value`, {
            'token': csmToken,
            'names': [secretPath]
        });
        
        const password = secretResponse.data[secretPath];
        addLog("Successfully authenticated and retrieved MySQL password.");
        return password || process.env.DB_PASSWORD || 'temppass'; 
    } catch (error) {
        addLog("CSM K8s authentication failed: " + (error.response?.data?.message || error.message));
        throw error;
    }
}

// Function to call Thales CRDP for protection/reveal
async function callCRDP(action, policyName, data) {
    const endpoint = action === 'protect' ? '/v1/protect' : '/v1/reveal';
    const payload = {
        [action === 'protect' ? 'protection_policy_name' : 'access_policy_name']: policyName,
        data: data
    };
    
    const cmUrl = process.env.CM_URL || 'http://crdpdemo';

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.CM_TOKEN) headers['Authorization'] = `Bearer ${process.env.CM_TOKEN}`;
        
        const response = await axios.post(`${cmUrl}${endpoint}`, payload, { headers });
        return response.data;
    } catch (error) {
        console.error(`CRDP ${action} failed:`, error.response?.data || error.message);
        throw error;
    }
}

// Initialize Database Connection
async function initDb() {
    try {
        const password = await getDbPassword();
        addLog("Connecting to MySQL Database...", { host: process.env.DB_HOST, user: process.env.DB_USER, database: process.env.DB_NAME });
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            password: password
        });
        addLog("Connected to MySQL Database.");
    } catch (error) {
        console.error("Database initialization failed:", error.message);
        process.exit(1);
    }
}

// Routes
app.get('/api/startup-logs', (req, res) => {
    res.json(backendLogs);
});
app.get('/api/records', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM customer_records ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/protect', async (req, res) => {
    const { name, email, credit_card } = req.body;
    
    try {
        const steps = [];
        const cmUrl = process.env.CM_URL || 'http://crdpdemo';
        const emailPolicy = process.env.CRDP_EMAIL_POLICY || 'email_policy';
        const ccPolicy = process.env.CRDP_CC_POLICY || 'cc_policy';
        
        steps.push({ 
            action: 'CRDP Protect Request', 
            endpoint: `${cmUrl}/v1/protect`, 
            payload: { policy: emailPolicy, data: email }
        });

        // Live Integration
        const emailProtection = await callCRDP('protect', emailPolicy, email);
        const ccProtection = await callCRDP('protect', ccPolicy, credit_card);
        
        const protectedData = {
            email: emailProtection.protected_data || emailProtection.data || `err(${email})`,
            credit_card: ccProtection.protected_data || ccProtection.data || `err(${credit_card})`
        };

        steps.push({ action: 'CRDP Protect Response', result: protectedData });

        const query = 'INSERT INTO customer_records (name, email, credit_card) VALUES (?, ?, ?)';
        const params = [name, protectedData.email, protectedData.credit_card];
        steps.push({ action: 'MySQL Insert', query, params });

        const [result] = await db.execute(query, params);

        res.json({ success: true, id: result.insertId, protectedData, backendSteps: steps });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reveal', async (req, res) => {
    const { id, field } = req.body;
    try {
        const steps = [];
        const query = `SELECT ${field} FROM customer_records WHERE id = ?`;
        steps.push({ action: 'MySQL Select', query, params: [id] });
        
        const [rows] = await db.execute(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const encryptedValue = rows[0][field];
        const emailPolicy = process.env.CRDP_EMAIL_POLICY || 'email_policy';
        const ccPolicy = process.env.CRDP_CC_POLICY || 'cc_policy';
        const policy = field === 'email' ? emailPolicy : ccPolicy;
        
        const cmUrl = process.env.CM_URL || 'http://crdpdemo';
        steps.push({ 
            action: 'CRDP Reveal Request', 
            endpoint: `${cmUrl}/v1/reveal`, 
            payload: { policy, data: encryptedValue }
        });

        // Live Integration
        const revealResult = await callCRDP('reveal', policy, encryptedValue);
        const decryptedValue = revealResult.revealed_data || revealResult.data || encryptedValue;

        steps.push({ action: 'CRDP Reveal Response', result: decryptedValue });

        res.json({ original: encryptedValue, revealed: decryptedValue, backendSteps: steps });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Wildcard route to serve index.html for SPA
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-dist/index.html'));
});

app.listen(PORT, async () => {
    console.log(`Backend server running on port ${PORT}`);
    await initDb();
});
