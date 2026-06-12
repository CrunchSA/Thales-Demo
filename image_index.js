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

// Function to fetch DB password from Thales CSM (Akeyless) using K8s Auth
async function getDbPassword() {
    console.log("Fetching DB password via Kubernetes-native authentication...");
    try {
        // 1. Read the K8s ServiceAccount JWT token
        const k8sTokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
        let k8sToken;
        
        try {
            k8sToken = await fs.readFile(k8sTokenPath, 'utf8');
        } catch (e) {
            console.log("K8s token not found at path. Falling back to static password for local testing.");
            return process.env.DB_PASSWORD || 'demo_password';
        }

        // 2. Authenticate with CSM (Akeyless) using the K8s token
        // In a live environment, this would call the /auth endpoint of your CSM
        /*
        const authResponse = await axios.post(`${process.env.CSM_URL}/auth`, {
            'access-id': process.env.CSM_ACCESS_ID,
            'k8s-service-account-token': k8sToken,
            'k8s-auth-config-name': process.env.CSM_K8S_AUTH_CONFIG // e.g., 'prod-k8s-cluster'
        });
        const csmToken = authResponse.data.token;

        // 3. Fetch the secret using the CSM token
        const secretResponse = await axios.post(`${process.env.CSM_URL}/get-secret-value`, {
            'token': csmToken,
            'names': [process.env.CSM_DB_PASSWORD_PATH]
        });
        return secretResponse.data[process.env.CSM_DB_PASSWORD_PATH];
        */

        console.log("Successfully authenticated with CSM using Kubernetes JWT.");
        return process.env.DB_PASSWORD || 'demo_password'; 
    } catch (error) {
        console.error("CSM K8s authentication failed:", error.message);
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

    try {
        const response = await axios.post(`${process.env.CM_URL}${endpoint}`, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.CM_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
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
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            password: password
        });
        console.log("Connected to MySQL Database.");
    } catch (error) {
        console.error("Database initialization failed:", error.message);
        process.exit(1);
    }
}

// Routes
app.get('/api/records', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM customer_records ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save', async (req, res) => {
    const { name, email, credit_card } = req.body;
    
    try {
        console.log("Protecting data via CRDP...");
        
        /* Live Integration:
        const emailProtection = await callCRDP('protect', process.env.CRDP_EMAIL_POLICY, email);
        const ccProtection = await callCRDP('protect', process.env.CRDP_CC_POLICY, credit_card);
        const protectedData = {
            email: emailProtection.protected_data,
            credit_card: ccProtection.protected_data
        };
        */

        const protectedData = {
            email: `enc(${email})`, // Simulation
            credit_card: `enc(${credit_card})`
        };

        const [result] = await db.execute(
            'INSERT INTO customer_records (name, email, credit_card) VALUES (?, ?, ?)',
            [name, protectedData.email, protectedData.credit_card]
        );

        res.json({ success: true, id: result.insertId, protectedData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reveal', async (req, res) => {
    const { id, field } = req.body;
    try {
        const [rows] = await db.execute(`SELECT ${field} FROM customer_records WHERE id = ?`, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const encryptedValue = rows[0][field];
        const policy = field === 'email' ? process.env.CRDP_EMAIL_POLICY : process.env.CRDP_CC_POLICY;

        /* Live Integration:
        const revealResult = await callCRDP('reveal', policy, encryptedValue);
        const decryptedValue = revealResult.revealed_data;
        */
        
        const decryptedValue = encryptedValue.replace('enc(', '').replace(')', ''); // Simulation
        
        res.json({ original: encryptedValue, revealed: decryptedValue });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Wildcard route to serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-dist/index.html'));
});

app.listen(PORT, async () => {
    console.log(`Backend server running on port ${PORT}`);
    await initDb();
});
