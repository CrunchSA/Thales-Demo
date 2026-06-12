# Thales CipherTrust Demo - Deployment Guide

This project demonstrates **CipherTrust Secrets Management (CSM)** and **RESTful Data Protection (CRDP)** in a Kubernetes environment. The application features a dynamic UI that reveals backend system events and API calls in real-time for demonstration purposes by using a back-end MySQL database for storage and retreival of user-submitted information in a web app.

## Project Structure
- `/app/frontend`: React (TS) + Tailwind CSS UI featuring a real-time API Diagnostics Log.
- `/app/backend`: Node.js Express server (integrates live with Thales APIs & MySQL).
- `/k8s`: Kubernetes Deployment, Service, and ConfigMap manifests using the `thales-demo` namespace.
- `Dockerfile`: Multi-stage build for the unified application image.

## Prerequisites

Before deploying this demo ensure the following are already in place:

- An existing CRDP deployment with an application defined and reachable (the demo calls the CRDP service at `CM_URL`).
- A configured Akeyless / CipherTrust gateway that stores the MySQL password and is reachable from the backend.
- A Kubernetes Auth Method configured for the `thales-demo-sa` ServiceAccount in the `thales-demo` namespace (so the backend can exchange its ServiceAccount token for CSM credentials).
- `kubectl` access to the target cluster with permissions to create the `thales-demo` namespace and apply the manifests.

## Deployment Steps

### 1. Configure Akeyless & Kubernetes Secrets
Before deploying, configure your CipherTrust/Akeyless appliance:

**MySQL Password:** Create a secret in CipherTrust Secrets Manager/Akeyless with the value `temppass`. The backend will fetch this dynamically at startup to authenticate with the database.
**K8s Auth Method:** Ensure you have configured a Kubernetes Auth Method in your Akeyless console that matches the `thales-demo-sa` ServiceAccount and the `thales-demo` namespace.

Next, create the ConfigMaps and Secrets in your cluster using your own environment-specific values:
```bash
# Create the namespace first
kubectl create namespace thales-demo

# Create ConfigMap for CRDP/Akeyless URLs and policy settings
kubectl create configmap -n thales-demo thales-config \
  --from-literal=CM_URL="<YOUR_CRDP_URL>" \
  --from-literal=CSM_URL="<YOUR_CSM_API_URL>" \
  --from-literal=CSM_DB_PASSWORD_PATH="<YOUR_CSM_DB_SECRET_PATH>" \
  --from-literal=CRDP_CC_POLICY="<YOUR_CC_POLICY_NAME>" \
  --from-literal=CRDP_EMAIL_POLICY="<YOUR_EMAIL_POLICY_NAME>" \
  --from-literal=CSM_K8S_AUTH_CONFIG="<YOUR_K8S_AUTH_CONFIG_NAME>"

# Create Secret for sensitive credentials
kubectl create secret generic thales-secrets -n thales-demo \
  --from-literal=CM_TOKEN="<YOUR_CRDP_TOKEN>" \
  --from-literal=CSM_ACCESS_ID="<YOUR_CSM_ACCESS_ID>"
```

### CRDP Policies

Confirm the CRDP policies referenced by the demo (`CRDP_CC_POLICY`, `CRDP_EMAIL_POLICY`) exist in your CRDP/CM instance and are associated with the application used by this demo. If they do not exist, create them via the CRDP management UI or API and update the `thales-config` ConfigMap with the exact policy names or IDs.


### 2. Deploy to Cluster
Apply the manifests:
```bash
kubectl apply -f k8s/mysql.yaml
kubectl apply -f k8s/app.yaml
```

### 3. Access the Demo
The app is exposed via a `NodePort` service. Get the assigned port and access it via your node's IP:
```bash
kubectl get service thales-demo-app -n thales-demo
```

## Security Features Demonstrated
1. **Kubernetes-Native Secrets:** At startup, the backend reads its **ServiceAccount Token** (JWT) and exchanges it dynamically at the `CSM_URL/auth` endpoint. It then fetches the MySQL password from Akeyless. No static `ACCESS_KEY` is stored in the cluster.
2. **Field-Level Protection:** PII (Email, Credit Card) is encrypted via live calls to the CRDP container `/v1/protect` endpoint before being written to MySQL.
3. **Auditability & Visibility:** Every "Protect" and "Reveal" action in the UI triggers a call to the CipherTrust Manager. The frontend's API Diagnostics Log surfaces these internal backend network traces so you can visually demonstrate the exact API calls occurring under the hood.
