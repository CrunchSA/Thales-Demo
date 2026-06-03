# Thales CipherTrust Demo - Deployment Guide

This project demonstrates **CipherTrust Secrets Management (CSM)** and **RESTful Data Protection (CRDP)** in a Kubernetes environment. The application features a dynamic UI that reveals backend system events and API calls in real-time for demonstration purposes.

## Project Structure
- `/app/frontend`: React (TS) + Tailwind CSS UI featuring a real-time API Diagnostics Log.
- `/app/backend`: Node.js Express server (integrates live with Thales APIs & MySQL).
- `/k8s`: Kubernetes Deployment, Service, and ConfigMap manifests using the `thales-demo` namespace.
- `Dockerfile`: Multi-stage build for the unified application image.

## Deployment Steps

### 1. Build the Container
From the root directory:
```bash
docker build -t ghcr.io/crunchsa/thales-demo-app:latest .
docker push ghcr.io/crunchsa/thales-demo-app:latest
```

### 2. Configure Akeyless & Kubernetes Secrets
Before deploying, configure your CipherTrust/Akeyless appliance:

1. **MySQL Password:** Create a secret in Akeyless at the path `/secrets/mysql-pass` with the value `temppass`. The backend will fetch this dynamically at startup to authenticate with the database.
2. **K8s Auth Method:** Ensure you have configured a Kubernetes Auth Method in your Akeyless console that matches the `thales-demo-sa` ServiceAccount and the `thales-demo` namespace.

Next, create the ConfigMaps and Secrets in your cluster:
```bash
# Create the namespace first
kubectl create namespace thales-demo

# Create ConfigMap for CRDP/Akeyless URLs
kubectl create configmap -n thales-demo thales-config \
  --from-literal=CM_URL="http://crdpdemo" \
  --from-literal=CSM_URL="https://ciphertrust.thegrahamfam.com/akeyless" \
  --from-literal=CSM_DB_PASSWORD_PATH="/se-accounts/csm-christian.graham/Thales-Demo-MySQL"

# Create Secret for sensitive credentials
kubectl create secret generic thales-secrets -n thales-demo \
  --from-literal=CM_TOKEN="your-crdp-token" \
  --from-literal=CSM_ACCESS_ID="your-csm-auth-method-id"
```

### 3. Deploy to Cluster
Apply the manifests:
```bash
kubectl apply -f k8s/mysql.yaml
kubectl apply -f k8s/app.yaml
```

### 4. Access the Demo
The app is exposed via a `NodePort` service. Get the assigned port and access it via your node's IP:
```bash
kubectl get service thales-demo-app -n thales-demo
```

## Security Features Demonstrated
1. **Kubernetes-Native Secrets:** At startup, the backend reads its **ServiceAccount Token** (JWT) and exchanges it dynamically at the `CSM_URL/auth` endpoint. It then fetches the MySQL password from Akeyless. No static `ACCESS_KEY` is stored in the cluster.
2. **Field-Level Protection:** PII (Email, Credit Card) is encrypted via live calls to the CRDP container `/v1/protect` endpoint before being written to MySQL.
3. **Auditability & Visibility:** Every "Protect" and "Reveal" action in the UI triggers a call to the CipherTrust Manager. The frontend's API Diagnostics Log surfaces these internal backend network traces so you can visually demonstrate the exact API calls occurring under the hood.
