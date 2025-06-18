# DataHaven Deployment Guide

This comprehensive guide covers prerequisites and deployment instructions for deploying DataHaven to a Kubernetes cluster from your machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Environment](#local-development-environment)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

## Prerequisites

### System Requirements

- **Operating System**: macOS or Linux recommended
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: At least 20GB free disk space
- **Network**: Stable internet connection for downloading dependencies

### Required Software

#### Core Dependencies

1. **Docker & Docker Compose**
   ```bash
   # macOS (using Homebrew)
   brew install --cask docker
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install docker.io docker-compose
   sudo usermod -aG docker $USER
   
   # Verify installation
   docker --version
   docker-compose --version
   ```

2. **Kurtosis** (for test networks)
   ```bash
   # macOS
   brew install kurtosis-tech/tap/kurtosis-cli
   
   # Linux
   curl -L https://github.com/kurtosis-tech/kurtosis-cli-release-artifacts/releases/latest/download/install-kurtosis.sh | bash
   
   # Verify installation
   kurtosis version
   ```

3. **Bun** (TypeScript runtime)
   ```bash
   # macOS
   brew install bun
   
   # Linux
   curl -fsSL https://bun.sh/install | bash
   
   # Verify installation
   bun --version
   ```

#### Platform-Specific Requirements

**macOS Users:**
- Install Zig for cross-compilation:
  ```bash
  brew install zig
  ```

**Linux Users:**
- Consider disabling IPv6 if experiencing network issues with Kurtosis
- Ensure Docker networking is properly configured

#### Development Tools

1. **AWS CLI** (for cloud deployments)
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Helm** (Kubernetes package manager)
   ```bash
   # macOS
   brew install helm
   
   # Linux
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   ```

3. **k9s** (Kubernetes CLI tool - optional)
   ```bash
   # macOS
   brew install k9s
   
   # Linux
   wget https://github.com/derailed/k9s/releases/latest/download/k9s_Linux_amd64.tar.gz
   tar -xzf k9s_Linux_amd64.tar.gz
   sudo mv k9s /usr/local/bin/
   ```


## Deployment prerequisites

### Kubernetes Cluster Setup

#### 1. Configure kubectl for AWS EKS

> ⚠️ **WARNING**  
> This is a permissioned step. You need to get credentials for configuring AWS.
>

```bash
# Install AWS CLI and configure credentials
aws configure --profile dh-poc

# Update kubeconfig for your EKS cluster
aws eks --region us-east-1 update-kubeconfig --name vira-dh-poc-cluster --profile dh-poc
```

#### 2. Test your configuration

```bash
# Verify connection
kubectl cluster-info

# Verify nodes, you should see some nodes listed
kubectl get nodes

# Verify pods, you should see a long list of kubernetes pods
kubectl get pods -A
```

#### 3. Configure Kurtosis for Cloud Deployment

Create/replace your Kurtosis config file with the following command. 

```bash
cat > "$(kurtosis config path)" << 'EOF'
config-version: 2
should-send-metrics: true
kurtosis-clusters:
  docker:
    type: "docker"
  minikube:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "minikube"
      storage-class: "standard"
      enclave-size-in-megabytes: 10
  cloud:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "vira-dh-poc-cluster"
      storage-class: "gp2"
      enclave-size-in-megabytes: 10
EOF
```

This will add three kurtosis clusters. You won't need all of them at once, but is good to have them configured. First one is docker, second is for minikube (useful for some), and the third one is the one we'll use for the deployment to kubernetes.  Alternatively, you can check your current Kurtosis config file:

```bash
kurtosis config path
```

And manually paste the contents:

```yaml
config-version: 2
should-send-metrics: true
kurtosis-clusters:
  docker:
    type: "docker"
  minikube:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "minikube"
      storage-class: "standard"
      enclave-size-in-megabytes: 10
  cloud:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "vira-dh-poc-cluster"
      storage-class: "gp2"
      enclave-size-in-megabytes: 10

```

```bash
# Set your cloud cluster as the target
kurtosis cluster set cloud

# In a separete terminal, run and keep the gateway running
kurtosis gateway
```


#### 4. (Optional) Test a simple deployment

```bash
# Creates a test-network.yml file
echo -e "participants:\n  - el_type: geth\n    cl_type: prysm\n    vc_type: prysm\n    count: 2\n\nadditional_services:\n  - spamoor" > test-network.yml

# Run the test network and wait until it succeeds
kurtosis run --enclave local-eth-testnet github.com/ethpandaops/ethereum-package --args-file test-network.yml
```


## Deployment

> ⚠️ **WARNING**  
> This is a permissioned step. You need to get credentials for DockerHub.
>

#### 1. Get DockerHub credentials
This is to be able to pull from the DockerHub private repo, and it's a temporary step until the repository is public.

#### 2. Make sure you login into docker
```bash
# Complete the password interactively
docker login -u <username>

# Check you can access the datahaven image's manifest
docker manifest inspect moonsonglabs/datahaven:main
```

#### 3. Run the deploy command with the credentials

```bash
bun cli deploy --docker-username=<username> --docker-password=<pass> --docker-email=<email>
```

If everything went well, you will see something like:

> [17:24:01.058] INFO (59757): ✅ Deploy function completed successfully in 28.4 minutes

## Access Kubernetes dashboard: k9s

```bash
# In a new terminal
k9s -n kt-datahaven-stagenet
```
**Tip**: *type '?' to access to all key bindings to navigate the dashboard, press 'Enter' to access an object, and 'Esc' to go back.*

You can also check https://k9scli.io/topics/commands/ for a list of available commands and bindings.

## Help commands (for reference only)

> ⚠️ **WARNING**  
> No need to run these commands, they are just for reference and troubleshooting.
>

### DataHaven

#### 1. Access Validator Node

```bash
# Port forward to access Polkadot.js apps
kubectl port-forward svc/dh-validator-0 -n kt-datahaven-stagenet 9955:9955

# Access via Polkadot.js apps
# https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9955#/explorer
```

#### 2. Run DataHaven charts

```bash
cd deployment/charts/node

# Deploy bootnode
helm upgrade --install dh-bootnode . \
  -f ./datahaven/dh-bootnode.yaml \
  -n kt-datahaven-stagenet

# Deploy validators
helm upgrade --install dh-validator . \
  -f ./datahaven/dh-validator.yaml \
  -n kt-datahaven-stagenet
```

### Snowbridge Relayers Deployment

#### 1. Create Required Secrets

```bash
# Create secrets for relayer private keys
kubectl create secret generic dh-beefy-relay-ethereum-key \
  --from-literal=pvk="<PRIVATE_KEY>" \
  -n kt-datahaven-stagenet

kubectl create secret generic dh-beacon-relay-substrate-key \
  --from-literal=pvk="<PRIVATE_KEY>" \
  -n kt-datahaven-stagenet

kubectl create secret generic dh-execution-relay-substrate-key \
  --from-literal=pvk="<PRIVATE_KEY>" \
  -n kt-datahaven-stagenet
```

#### 2. Deploy Relayers

```bash
cd deployment/charts/snowbridge

# Deploy all relayers
helm upgrade --install dh-beacon-relay . \
  -f ./snowbridge/dh-beacon-relay.yaml \
  -n kt-datahaven-stagenet

helm upgrade --install dh-beefy-relay . \
  -f ./snowbridge/dh-beefy-relay.yaml \
  -n kt-datahaven-stagenet

helm upgrade --install dh-execution-relay . \
  -f ./snowbridge/dh-execution-relay.yaml \
  -n kt-datahaven-stagenet
```

### Docker Registry Configuration

```bash
# Create Docker registry secret for private images
kubectl create secret docker-registry datahaven-dockerhub \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<your-username> \
  --docker-password=<your-password> \
  --docker-email=<your-email> \
  -n kt-datahaven-stagenet
```

### Cleanup and Maintenance

#### Remove Deployments
```bash
# Remove nodes
helm uninstall dh-bootnode -n kt-datahaven-stagenet
helm uninstall dh-validator -n kt-datahaven-stagenet

# Remove relayers
helm uninstall dh-beacon-relay -n kt-datahaven-stagenet
helm uninstall dh-beefy-relay -n kt-datahaven-stagenet
helm uninstall dh-execution-relay -n kt-datahaven-stagenet

# Clean up persistent volumes
kubectl delete pvc -l app.kubernetes.io/instance=dh-bootnode -n kt-datahaven-stagenet
kubectl delete pvc -l app.kubernetes.io/instance=dh-validator -n kt-datahaven-stagenet

# Delete secrets
kubectl delete secret <secret-name> -n kt-datahaven-stagenet
```
