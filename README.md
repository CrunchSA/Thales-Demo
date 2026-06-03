# Thales CipherTrust Demo - Deployment Guide

This project demonstrates **CipherTrust Secrets Management (CSM)** and **RESTful Data Protection (CRDP)** in a Kubernetes environment.

## Project Structure
- `/app/frontend`: React (TS) + Tailwind CSS UI.
- `/app/backend`: Node.js Express server (integrates with Thales APIs & MySQL).
- `/k8s`: Kubernetes Deployment, Service, and ConfigMap manifests.
- `Dockerfile`: Multi-stage build for the unified application image.

## Deployment Steps

### 1. Build the Container
From the root directory:
```bash
docker build -t your-registry/thales-demo-app:latest .
docker push your-registry/thales-demo-app:latest
```

### 2. Configure Kubernetes Secrets
Before deploying, create the secrets and configmaps for your CipherTrust appliance:

```bash
# Create ConfigMap for non-sensitive data
kubectl create configmap -n thales-demo thales-config --from-literal=CM_URL="https://your-cm-ip"

# Create Secret for sensitive credentials
kubectl create secret generic thales-secrets \
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
The app is exposed via a `LoadBalancer` service. Get the external IP:
```bash
kubectl get service thales-demo-app
```

## Security Features Demonstrated
1. **Kubernetes-Native Secrets:** The backend uses the pod's **ServiceAccount Token** (JWT) to authenticate with CSM. No static `ACCESS_KEY` is stored in the cluster (see `app/backend/index.js`).
2. **Field-Level Protection:** PII (Email, Credit Card) is encrypted via CRDP before being written to MySQL.
3. **Auditability:** Every "Reveal" action in the UI triggers a call to the CipherTrust Manager, creating an audit trail.

## Prerequisites for K8s Auth
Ensure you have configured a **Kubernetes Auth Method** in your Thales CSM (Akeyless) console that matches the `thales-demo-sa` ServiceAccount and the namespace you deploy into.
