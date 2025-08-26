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
  
    Refer to https://docs.docker.com/engine/install/ for full installation instructions.

2. **Kurtosis** (for test networks)
   ```bash
   # macOS
   brew install kurtosis-tech/tap/kurtosis-cli
   
   # Linux
   curl -L https://github.com/kurtosis-tech/kurtosis-cli-release-artifacts/releases/latest/download/install-kurtosis.sh | bash
   
   # Verify installation
   kurtosis version
   ```
  
    Refer to https://docs.kurtosis.com/install/ for full installation instructions.


3. **Bun** (TypeScript runtime)
   ```bash
   # Homebrew 
   brew install oven-sh/bun/bun
   
   # macOS / Linux
   curl -fsSL https://bun.sh/install | bash
   
   # Verify installation
   bun --version
   ```

    Refer to https://bun.sh/docs/installation for full installation instructions.

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

    Refer to https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html for full installation instructions.

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

   Refer to https://k9scli.io/topics/install/ for full installation instructions.
   
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
  docker.k8s:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "docker-desktop"
      storage-class: "hostpath"
      enclave-size-in-megabytes: 10
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

This will add four kurtosis clusters. You won't need all of them at once, but is good to have them configured.

1. **Docker containers**

This is usually only for running kurtosis directly to docker containers, it doesn't need a specific config, and it's equivalent to what we use in the `bun cli launch` command.

```yaml
  docker:
    type: "docker"
```

2. **Docker Kubernetes**

For macOS users or everyone that can run Docker Desktop, you can check this docs to enable Kubernetes natively on your Docker Desktop app: https://docs.docker.com/desktop/features/kubernetes/

```yaml
  docker.k8s:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "docker-desktop"
      storage-class: "hostpath"
      enclave-size-in-megabytes: 10
```

2. **Minikube**

Great tool for running local Kubernetes clusters, you can check installation instructions here: https://minikube.sigs.k8s.io/docs/start/

```yaml
  minikube:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "minikube"
      storage-class: "standard"
      enclave-size-in-megabytes: 10
```

4. **Kubernetes**

This is gonna be for a production deployment.

```yaml
  cloud:
    type: "kubernetes"
    config:
      kubernetes-cluster-name: "vira-dh-poc-cluster"
      storage-class: "gp2"
      enclave-size-in-megabytes: 10
```

If yout don't want all of them, you can always check your Kurtosis config file and add the desired clusters under `kurtosis-clusters:`

```bash
kurtosis config path
```

And manually paste the contents:

```yaml
config-version: 2
should-send-metrics: true
kurtosis-clusters:
  ...
```

#### 4. Deployment

```bash
# Set your Docker kubernetes
kurtosis cluster set <pick-a-cluster-option> # For local use `kurtosis cluster set docker.k8s`
```
You can pick between the three options configure :
* `docker.k8s` -> For local deployment
* `minikube` -> To deploy with minikube
* `cloud` -> Use for cloud-hosted Kubernetes cluster


```bash
# In a separete terminal, run and keep the gateway running (we still need this to communicate from local machine to the local kubernetes cluster)
kurtosis gateway
```

#### 5. Test a simple deployment (recommended)
Before going any further, it's highly recommended that you test your config by creating a simple test network and runing it. Below, the steps:

```bash
# Creates a test-network.yml file
echo -e "participants:\n  - el_type: geth\n    cl_type: prysm\n    vc_type: prysm\n    count: 2\n\nadditional_services:\n  - spamoor" > test-network.yml

# Run the test network and wait until it succeeds
kurtosis run --enclave local-eth-testnet github.com/ethpandaops/ethereum-package --args-file test-network.yml
```

You can also go for testing against the provided hello-world by Kurtosis.

```bash
~ kurtosis run --enclave test-k8s github.com/kurtosis-tech/awesome-kurtosis/hello-world
```

## Deployment

### Access to GitHub

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
docker manifest inspect datahavenxyz/datahaven:main
```

### Remote deployment

#### 3. Run the deploy command with the credentials

```bash
bun cli deploy --docker-username=<username> --docker-password=<pass> --docker-email=<email>
```

If everything went well, you will see something like:

> [17:24:01.058] INFO (59757): ✅ Deploy function completed successfully in 28.4 minutes

### Local deployment

```bash
bun cli deploy --docker-username=<username> --docker-password=<pass> --docker-email=<email> --e local
```

## Access Kubernetes dashboard: k9s

```bash
# In a new terminal
k9s -n kt-datahaven-stagenet
```
**Tip**: *type '?' to access to all key bindings to navigate the dashboard, press 'Enter' to access an object, and 'Esc' to go back.*

You can also check https://k9scli.io/topics/commands/ for a list of available commands and bindings.


## Troubleshooting

### Using the right context

Ensure your Kubernetes context (shown by 'kubectl config current-context') matches the cluster Kurtosis is set to use (shown by 'kurtosis cluster get').
For Docker Desktop, use 'docker-desktop' context and 'docker.k8s' cluster. For Minikube, use 'minikube' context and 'minikube' cluster.

```bash
# List available contexts
kubectl config get-contexts

# If you want to use Docker Desktop's Kubernetes, switch context:
kubectl config use-context docker-desktop

# If you want to use Minikube, switch context:
kubectl config use-context minikube

# Verify your current context:
kubectl config current-context

# Make sure your Kurtosis cluster matches your Kubernetes context:
kurtosis cluster get

```

### RBAC Permission Issues (Kubernetes clusters only)

You shouldn't, but If you get an error like "Failed to create cluster role with name 'kurtosis-logs-collector-*'" or "is attempting to grant RBAC permissions not currently held", you can use this to fix the RBAC permissions:

```bash
# Get the service account name from the error message and create a cluster role binding
kubectl create clusterrolebinding kurtosis-logs-collector --clusterrole=cluster-admin --serviceaccount=<namespace>:<serviceaccount>

# Example (replace with the actual service account from your error):
kubectl create clusterrolebinding kurtosis-logs-collector --clusterrole=cluster-admin --serviceaccount=kurtosis-engine-43c7ccedab104a1f86fa8839637141e2:kurtosis-engine-43c7ccedab104a1f86fa8839637141e2
```

**Note:** This gives the Kurtosis engine cluster-admin privileges, which is acceptable for local development but should be avoided in production environments.


### Make sure storage-class matches your config

If you have a similar error to this :
```
▶ Deploying DataHaven Network
──────────────────────────────
[22:45:21.779] INFO (248627): ✅ Image datahavenxyz/datahaven:main found on Docker Hub
[22:45:21.780] INFO (248627): 🔍 Checking if Kubernetes namespace "kt-datahaven-local" exists...
[22:45:21.858] INFO (248627): ✅ Namespace "kt-datahaven-local" already exists
[22:45:21.858] INFO (248627): 🔐 Creating Docker Hub secret...
[22:45:21.927] INFO (248627): ✅ Docker Hub secret created successfully
[22:45:21.928] INFO (248627): 🚀 Deploying DataHaven bootnode with helm chart...
62 | 
63 |   // Deploy DataHaven bootnode and validators with helm chart.
64 |   logger.info("🚀 Deploying DataHaven bootnode with helm chart...");
65 |   const bootnodeTimeout = "10m"; // 10 minutes
66 |   logger.debug(
67 |     await $`helm upgrade --install dh-bootnode charts/node \
                    ^
ShellError: Failed with exit code 1
 exitCode: 1,
   stdout: "Release \"dh-bootnode\" does not exist. Installing it now.\n",
   stderr: "Error: context deadline exceeded\n",

      at new ShellError (13:16)
      at new ShellPromise (75:16)
      at BunShell (191:35)
      at <anonymous> (/home/lola/Workspace/Moonsonglabs/datahaven/test/cli/handlers/deploy/datahaven.ts:67:11)

Bun v1.2.17 (Linux x64)
error: script "cli" exited with code 1
```

If say you're using a kurtosis cluster that has a storage-class different from `"hostpath"`when you run locally (i.e. `"standard"`, for minikube), then you might get some errors when trying to execute the helm charts.

Look for this chunk in  `deploy/environments/local/values.yaml`:

```yaml
# Common node settings
node:
  chain: local
  chainData:
    storageClass: "hostpath"
    persistence:
      size: 10Gi
  ...
```

### Minikube purge

To purge delete everything on minikube and restart :
```
minikube delete --all --purge
```


And try changing storageClass to whatever you have configured in the cluster. Good luck!

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
