# CipherTrust Setup Script

This script initializes the necessary applications and policies in CipherTrust for the Thales Demo application.

## Prerequisites

- Node.js installed
- Access to a CipherTrust server
- CipherTrust API credentials (username and password)
- Network connectivity to the CipherTrust server

## Setup

### 1. Configure Credentials

Copy the example environment file and add your CipherTrust credentials:

```bash
cp .env.ciphertrust.example .env.local
```

Edit `.env.local` and fill in your CipherTrust server details:

```
CIPHERTRUST_URL=https://your-ciphertrust-server.com:5696
CIPHERTRUST_USERNAME=your-admin-username
CIPHERTRUST_PASSWORD=your-admin-password
CIPHERTRUST_DOMAIN=default
```

### 2. Run the Setup Script

```bash
node scripts/setup-ciphertrust.js
```

The script will:
- ✅ Authenticate with CipherTrust
- ✅ Create a protection policy for data encryption
- ✅ Create an access policy for role-based access control
- ✅ Create an application registration in CipherTrust

### 3. Save Configuration

After successful setup, the script outputs the IDs you'll need. Update your `.env.local` with:

```
CIPHERTRUST_APP_ID=<output-id>
CIPHERTRUST_PROTECTION_POLICY=<output-id>
CIPHERTRUST_ACCESS_POLICY=<output-id>
```

## What Gets Created

### Protection Policy
- **Name**: `app-protection-policy`
- **Algorithm**: AES-256-CBC
- **Purpose**: Encryption policy for sensitive application data

### Access Policy
- **Name**: `app-access-policy`
- **Permissions**:
  - Read protection policies
  - Use encryption keys
  - Create new keys

### Application
- **Name**: `thales-demo-app`
- **Type**: Service application
- **Purpose**: Represents your backend service in CipherTrust

## Customization

To customize the policies and applications created, edit the respective functions in `scripts/setup-ciphertrust.js`:

- `createProtectionPolicy()` - Modify encryption settings
- `createAccessPolicy()` - Adjust access control rules
- `createApplication()` - Change application properties

## Troubleshooting

### Authentication Failed
- Verify credentials in `.env.local`
- Check network connectivity to the CipherTrust server
- Ensure the user has API access permissions

### Policy Already Exists
- The script handles existing policies gracefully
- If you need to recreate, delete the existing policies from CipherTrust first

### API Endpoint Mismatch
- Verify your CipherTrust API version matches the endpoints
- Common endpoints: `/api/v1/` for most versions

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CIPHERTRUST_URL` | Yes | Base URL of CipherTrust server |
| `CIPHERTRUST_USERNAME` | Yes | Administrative username |
| `CIPHERTRUST_PASSWORD` | Yes | Administrative password |
| `CIPHERTRUST_DOMAIN` | No | Partition/domain name (default: "default") |

## Dependencies

The script uses existing project dependencies:
- `axios` - HTTP client for API requests
- `dotenv` - Environment variable management
