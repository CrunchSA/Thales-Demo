#!/usr/bin/env node

/**
 * CipherTrust Setup Script
 * 
 * This script initializes the necessary applications and policies in CipherTrust
 * for the Thales Demo application to work properly.
 * 
 * Required environment variables:
 * - CIPHERTRUST_URL: Base URL for CipherTrust API (e.g., https://ciphertrust-server.com)
 * - CIPHERTRUST_USERNAME: Username for authentication
 * - CIPHERTRUST_PASSWORD: Password for authentication
 * - CIPHERTRUST_DOMAIN: Domain/partition name (optional, defaults to "default")
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Configuration
const config = {
  baseURL: process.env.CIPHERTRUST_URL,
  username: process.env.CIPHERTRUST_USERNAME,
  password: process.env.CIPHERTRUST_PASSWORD,
  domain: process.env.CIPHERTRUST_DOMAIN || 'default',
};

// Validate configuration
const validateConfig = () => {
  const required = ['baseURL', 'username', 'password'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    console.error('❌ Error: Missing required environment variables:', missing.map(k => `CIPHERTRUST_${k.toUpperCase()}`).join(', '));
    process.exit(1);
  }
};

// Create axios instance with authentication
let apiClient;
const initializeAPIClient = async () => {
  apiClient = axios.create({
    baseURL: config.baseURL,
    validateStatus: () => true, // Don't throw on any status code
  });

  // Authenticate and get token
  try {
    console.log('🔐 Authenticating with CipherTrust...');
    const response = await apiClient.post('/api/v1/auth/login', {
      username: config.username,
      password: config.password,
    });

    if (response.status !== 200) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const token = response.data.token;
    
    // Add token to default headers
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✅ Authentication successful');
    
    return token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    process.exit(1);
  }
};

// Create Protection Policy
const createProtectionPolicy = async () => {
  try {
    console.log('\n📋 Creating protection policy...');
    
    const policyData = {
      name: 'app-protection-policy',
      description: 'Protection policy for Thales Demo application data',
      algorithm: 'AES',
      keySize: 256,
      cipher: 'CBC',
      padding: 'PKCS5',
    };

    const response = await apiClient.post('/api/v1/protection-policies', policyData);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Protection policy created successfully');
      console.log(`   ID: ${response.data.id}`);
      return response.data;
    } else if (response.status === 409) {
      console.log('⚠️  Protection policy already exists');
      return response.data;
    } else {
      throw new Error(`Failed to create protection policy: ${response.status} ${response.data?.message || ''}`);
    }
  } catch (error) {
    console.error('❌ Error creating protection policy:', error.message);
    throw error;
  }
};

// Create Access Policy
const createAccessPolicy = async () => {
  try {
    console.log('\n📋 Creating access policy...');
    
    const policyData = {
      name: 'app-access-policy',
      description: 'Access policy for Thales Demo application',
      rules: [
        {
          resource: 'app-protection-policy',
          action: 'read',
          effect: 'allow',
        },
        {
          resource: 'keys',
          action: 'use',
          effect: 'allow',
        },
        {
          resource: 'keys',
          action: 'create',
          effect: 'allow',
        },
      ],
    };

    const response = await apiClient.post('/api/v1/access-policies', policyData);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Access policy created successfully');
      console.log(`   ID: ${response.data.id}`);
      return response.data;
    } else if (response.status === 409) {
      console.log('⚠️  Access policy already exists');
      return response.data;
    } else {
      throw new Error(`Failed to create access policy: ${response.status} ${response.data?.message || ''}`);
    }
  } catch (error) {
    console.error('❌ Error creating access policy:', error.message);
    throw error;
  }
};

// Create Application
const createApplication = async (protectionPolicy, accessPolicy) => {
  try {
    console.log('\n📋 Creating application...');
    
    const appData = {
      name: 'thales-demo-app',
      description: 'Thales Demo Application',
      type: 'service',
      protectionPolicy: protectionPolicy.id,
      accessPolicy: accessPolicy.id,
    };

    const response = await apiClient.post('/api/v1/applications', appData);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Application created successfully');
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Name: ${response.data.name}`);
      return response.data;
    } else if (response.status === 409) {
      console.log('⚠️  Application already exists');
      return response.data;
    } else {
      throw new Error(`Failed to create application: ${response.status} ${response.data?.message || ''}`);
    }
  } catch (error) {
    console.error('❌ Error creating application:', error.message);
    throw error;
  }
};

// Main setup function
const setup = async () => {
  try {
    console.log('🚀 Starting CipherTrust setup...\n');
    
    validateConfig();
    await initializeAPIClient();

    // Create policies and application
    const protectionPolicy = await createProtectionPolicy();
    const accessPolicy = await createAccessPolicy();
    const application = await createApplication(protectionPolicy, accessPolicy);

    console.log('\n✨ Setup completed successfully!');
    console.log('\nConfiguration to use in your application:');
    console.log(`  CIPHERTRUST_APP_ID=${application.id}`);
    console.log(`  CIPHERTRUST_PROTECTION_POLICY=${protectionPolicy.id}`);
    console.log(`  CIPHERTRUST_ACCESS_POLICY=${accessPolicy.id}`);
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
};

// Run setup
setup();
