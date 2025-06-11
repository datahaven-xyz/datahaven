<!--
DO NOT EDIT README.md manually!
We're using [helm-docs](https://github.com/norwoodj/helm-docs) to render values of the chart.
If you updated values.yaml file make sure to render a new README.md locally before submitting a Pull Request.

If you're using [pre-commit](https://pre-commit.com/) make sure to install the hooks first:
```
pre-commit install
```
REAMDE.md will be updating automatically after that.

Otherwise, you should install helm-docs and manually update README.md. Navigate to repository root and run:
`helm-docs --chart-search-root=charts/node --template-files=README.md.gotmpl`

You may encounter `files were modified by this hook` error after updating README.md.gotmpl file when using pre-commit.
This is intended behaviour. Make sure to run `git add -A` once again to stage changes in the auto-updated REAMDE.md
-->

# Substrate/Polkadot node Helm chart

![Version: 5.15.0](https://img.shields.io/badge/Version-5.15.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)

## Overview
The Polkadot Helm Chart provides a convenient way to deploy and manage a Polkadot blockchain node in a Kubernetes cluster.
This chart is designed to be highly configurable, supporting various configurations and features of the Polkadot node,
including persistent storage, resource management, and custom networking.

**Features:**
- Compatible with all Substrate-based relaychains, including Polkadot, Kusama, Paseo, Westend, Rococo, and more.
- Compatible with all Substrate-based parachains, including Asset-hub, Bridge-hub, Coretime, People, Acala, Astar, Moonbase, and others.
- Deploy RPC, collators, validators, or full nodes in a Kubernetes cluster.
- Use snapshots to speed up the deployment process.
- Supports session key and node-key (ID) injection.

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Parity | <devops+helm@parity.io> | <https://github.com/paritytech/helm-charts> |

## Installing the chart

```console
helm repo add parity https://paritytech.github.io/helm-charts/
helm install polkadot-node parity/node
```

This will deploy a single Polkadot node with the default configuration.

### Public snapshots
You can use the following public URLs to download chain snapshots:
- https://snapshots.polkadot.io/polkadot-paritydb-prune
- https://snapshots.polkadot.io/polkadot-rocksdb-prune
- https://snapshots.polkadot.io/polkadot-rocksdb-archive
- https://snapshots.polkadot.io/kusama-paritydb-prune
- https://snapshots.polkadot.io/kusama-rocksdb-prune
- https://snapshots.polkadot.io/kusama-rocksdb-archive
- https://snapshots.polkadot.io/westend-paritydb-archive
- https://snapshots.polkadot.io/westend-paritydb-prune
- https://snapshots.polkadot.io/westend-rocksdb-prune
- https://snapshots.polkadot.io/westend-rocksdb-archive
- https://snapshots.polkadot.io/westend-collectives-rocksdb-archive

For example, to restore Polkadot pruned snapshot running ParityDB, configure chart values like the following:
```yaml
node:
  chain: polkadot
  role: full
  chainData:
    chainSnapshot:
      enabled: true
      method: http-filelist
      url: https://snapshots.polkadot.io/polkadot-paritydb-prune
    pruning: 256
```

Polkadot and Kusama backups are pruned at 256 blocks. Westend backups are pruned at 1000 blocks.

### Resizing the node disk

To resize the node persistent volume, perform the following steps:

1. Patch the PVC storage size, eg. to `1000Gi`:

```console
kubectl patch pvc chain-data-polkadot-node-0  -p '{"spec":{"resources":{"requests":{"storage":"1000Gi"}}}}}'
```

2. Delete the StatefulSet object with `cascade=orphan` (ie. without removing the attached pods):

```console
kubectl delete sts polkadot-node --cascade=orphan
```

3. Update the `node.chainData.volumeSize` to the new value (eg. `1000Gi`) and upgrade the helm release.

Note that for a Kubernetes Persistent Volume Claims to be resizable, its StorageClass must have specific characteristics. More information on this topic is available in the [Expanding Persistent Volumes Claims
section of the Kubernetes documentation](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#expanding-persistent-volumes-claims).

### Optional Vault Integration

To integrate this chart with vault:
- Vault agent injector [installed](https://www.vaultproject.io/docs/platform/k8s/injector/installation) on the cluster
- Kubernetes [auth enabled](https://learn.hashicorp.com/tutorials/vault/kubernetes-sidecar#configure-kubernetes-authentication) in your vault instance
- Secrets for either the keys or the nodeKey created in your vault using kv-2
- A policy for each of your secrets configured in your vault
- an authentication role crated in your vault instance (should match the serviceAccount name for this chart) with policies for accessing your keys attached

```
node:
  vault:
    keys:
      - name: aura
        type: aura
        scheme: sr25519
        vaultPath: kv/secret/polkadot-node # path at which the secret is located in Vault
        vaultKey: aura # key under which the secret value is stored in Vault
        extraDerivation: "//${HOSTNAME}//aura" # allows to have unique derived keys for each pod of the statefulset
    nodeKey:
      name: nodekey
      vaultPath: kv/secret/polkadot-node
      vaultKey: nodekey
```

### Setting Up Node Key for Bootnodes and Validators

For both bootnodes and validators (refer to [paritytech/polkadot-sdk#3852](https://github.com/paritytech/polkadot-sdk/pull/3852)), it is necessary to set up a network key.

#### Steps to Set Up a Node Key

1. **Generate a Custom Node Key**

   You can generate a custom node key using the following command:
   ```sh
   polkadot key generate-node-key
   ```

2. **Add the Generated Node Key**

   To add the generated node key, use the following configuration:

   ```yaml
   node:
     customNodeKey: "<your-generated-node-key>"
   ```

3. **Point to an Existing Node Key K8s Secret**

   If you have an existing Kubernetes secret for the node key, point to it using:

   ```yaml
   node:
     existingSecrets:
       nodeKey: "<your-existing-node-key-secret>"
   ```
4. **Retrieve Node Key from vault**

   see [Optional Vault Integration](#optional-vault-integration)

5. **Automatically Generate and Persist Node Key**

   Alternatively, you can set the following to automatically generate a node key on startup and store it to the volume:

   ```yaml
   node:
     persistGeneratedNodeKey: true
   ```

## Upgrade
### From v5.5.x to v5.5.2
- Fix Bug from v5.5.0: `--pruning` is alias for `--state-pruning` not `--blocks-pruning`.

### From v5.x.x to v5.5.0 (⚠️ breaking changes)
- The pruning flag is now using `--blocks-pruning` which starts from polkadot version v0.9.28
- The flag `--pruning` is now allowed in both .Values.node.flags and .Values.node.collatorRelayChain.flags. When using `--pruning`, ensure that the values of .Values.node.chainData.pruning and .Values.node.collatorRelayChain.chainData.pruning are explicitly set to `false` to maintain previous behavior.

### From v5.x.x to v5.3.0 (⚠️ breaking changes)
- The following flags have changed:
  - `externalRelayChain.*` -> replaced with `collatorExternalRelayChain.*` to match to new naming convention of different modes;

### From v4.x.x to v5.0.0 (⚠️ breaking changes)
- Chain backup upload functionality has been removed. I.e., the `node.enableChainBackupGcs` flag is no longer available. Backup upload was implemented in the form of init container. Since backup init container starts before the main container runs, the node does not have a chance to sync to the latest block. Instead, backup container syncs the DB chunks from the time the node was last online which most of the times would be a stale data. Additionally, after backup is completed the node will continue to run which is not always necessary as you probably just wanted to make a backup and exit the script. A more complete solution for making node backups will be published in the future releases of the chart;
- Chain backup download scripts have been updated to use [`rclone`](https://rclone.org/). Multiple flags associated with this functionality have changed. Chain backup and relay chain backup restoration are now controlled by `node.chainData.chainSnapshot.*` and `node.collatorRelayChain.chainData.chainSnapshot.*` blocks of flags accordingly.
- Chain backup restoration now supports a new method: downloading DB files by direct HTTP links using a list of files as a reference. I.e., a restoration process would first download a file containing a list of DB files that need to be downloaded. `rclone` will then use this file to generate HTTP links to the DB files and download it in parallel.
- The following flags have changed:
  - `initContainer.*` -> replaced with `initContainers.*` to enable individual configuration of each init container;
  - `kubectl.*` -> merged into `initContainers.*`;
  - `googleCloudSdk.*` -> replaced with `node.chainData.chainSnapshot.*` and `node.collatorRelayChain.chainData.chainSnapshot.*`
  - `node.chainData.snapshotUrl` -> replaced with `node.chainData.chainSnapshot.url`
  - `node.chainData.snapshotFormat` -> replaced with `node.chainData.chainSnapshot.method`
  - `node.chainData.GCSBucketUrl` -> replaced with `node.chainData.chainSnapshot.url`
  - `node.collatorRelayChain.chainData.snapshotUrl` -> replaced with `node.collatorRelayChain.chainData.chainSnapshot.url`
  - `node.collatorRelayChain.chainData.snapshotFormat` -> replaced with `node.collatorRelayChain.chainData.chainSnapshot.method`
  - `node.collatorRelayChain.chainData.GCSBucketUrl` -> replaced with `node.collatorRelayChain.chainData.chainSnapshot.url`

### v4.6.0 (⚠️ breaking change)

Substrate changed the default rpc flags: https://github.com/paritytech/substrate/pull/13384 \
The dual RPC ports; `--rpc-port=9933` (HTTP) ,`--ws-port=9944` (WS) was replaced by a combined port `--rpc-port=9944`.
Flags replaced:
```
--rpc-max--payload (replaced by --rpc--max-request-size and --rpc-max-response-size)
--ws-max-out-buffer-capacity (removed)
--ws-external (replaced by --rpc-external)
--unsafe-ws--external (replaced by --unsafe-rpc-external)
--ipc-path (removed)
--ws-port (replaced by --rpc-port)
--ws-max-connections (replaced by --rpc-max-connections)
--rpc-http (replaced by --rpc-addr)
--rpc-ws (replaced by --rpc-addr)
```
New value was added to support this change:
- `node.legacyRpcFlags`

If your node is still using the old RPC flags, please set `node.legacyRpcFlags=true`

### v4.5.0 (⚠️ small change)

The storage classes are now set to `""` by default instead of `"default"`.
Make sure that the following values are set to the storage classes you are using if not already set (before 4.5.0, those were set explicitly to `default`) :

- `node.chainData.storageClass`
- `node.chainKeystore.storageClass`
- `node.collatorRelayChain.chainData.storageClass`
- `node.collatorRelayChain.chainKeystore.storageClass`

### From v3.x.x to v4.0.0 (⚠️ breaking changes)

The following chart parameters have been renamed or rearranged:

- `node.pruning` -> `node.chainData.pruning`
- `node.database` -> `node.chainData.database`
- `node.collator.isParachain` -> `node.isParachain`
- `node.collator.relayChain` -> `node.collatorRelayChain.chain`
- `node.collator.relayChainCustomChainspecPath` -> `node.collatorRelayChain.customChainspecPath`
- `node.collator.relayChainCustomChainspecUrl` -> `node.collatorRelayChain.customChainspecUrl`
- `node.collator.relayChainFlags` -> `node.collatorRelayChain.flags`
- `node.collator.relayChainData.*` -> `node.collatorRelayChain.chainData.*`
- `node.collator.relayChainPruning` -> `node.collatorRelayChain.chainData.pruning`
- `node.collator.relayChainDatabase` -> `node.collatorRelayChain.chainData.database`
- `node.collator.relayChainKeystore.*` -> `node.collatorRelayChain.chainKeystore.*`
- `node.collator.relayChainPrometheus.*` -> `node.collatorRelayChain.prometheus.*`

The following flags are now invalid if they were previously set in `node.flags` or `node.collator.relayChainFlags`.
An error will be thrown if any of those flags are set directly.

- `--name`
- `--base-path`
- `--chain`
- `--validator`
- `--collator`
- `--light`
- `--database`
- `--pruning`
- `--prometheus-external`
- `--prometheus-port`
- `--node-key`
- `--wasm-runtime-overrides`
- `--jaeger-agent`
- `--rpc-methods`
- `--rpc-external`
- `--unsafe-rpc-external`
- `--ws-external`
- `--unsafe-ws-external`
- `--rpc-cors`
- `--rpc-port`
- `--ws-port`

### From v2.x.x to v3.0.0 (⚠️ breaking changes)
There are now separate volumes for:
- relaychain data
- relaychain keystore
- parachain data
- parachain keystore

Some chart parameters have been grouped together and renamed. There are now separate sections for the following values:
- `node.chainData`
- `node.chainKeystore`
- `node.collator`

Common `storageClass` parameter has been moved to the corresponding separate groups mentioned above.

As both the chain data and keystore can now be stored on up to 4 different volumes you may need to manually relocate the existing data to the newly created volumes.

If you're running a non-collator node:
- Move chain files from the `/data/chains/<chain_name>` in the `chain-data` volume to `/chain-data` in the `chain-data` volume.
- Move keystore files from the `/data/chains/<chain_name>/keystore` in the `chain-data` volume to `/keystore` in the `chain-keystore` volume.

If you're running a collator node:
- Move chain files from the `/data/chains/<chain_name>` in the `chain-data` volume to `/chain-data` in the `chain-data` volume.
- Move keystore files from the `/data/chains/<chain_name>/keystore` in the `chain-data` volume to `/keystore` in the `chain-keystore` volume.
- Move relaychain files from the `/data/relay/polkadot` in the `chain-data` volume to `/relaychain-data/polkadot` in the `relaychain-data` volume.
- Move relaychain keystore from `/data/relay/polkadot/chains/<relay_chain_name>/keystore` in the `chain-data` volume to `/relaychain-keystore` in the `relaychain-keystore` volume

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | Assign custom affinity rules |
| autoscaling.additionalMetrics | object | `{}` | Additional metrics to track |
| autoscaling.enabled | bool | `false` | Enable Horizontal Pod Autoscaler (HPA) |
| autoscaling.maxReplicas | string | `nil` | Scale up to this number of replicas |
| autoscaling.minReplicas | int | `1` | Maintain min number of replicas |
| autoscaling.targetCPU | string | `nil` | Target CPU utilization that triggers scale up |
| autoscaling.targetMemory | string | `nil` | Target memory utilization that triggers scale up |
| dnsPolicy | string | `""` | Field dnsPolicy can be set to 'ClusterFirst', 'Default', 'None', or 'ClusterFirstWithHostNet' or '' to not specify dnsPolicy and let Kubernetes use its default behavior |
| extraContainers | list | `[]` | Additional containers to run in the pod |
| extraInitContainers | list | `[]` | Additional init containers to run in the pod |
| extraLabels | object | `{}` | Additional common labels on pods and services |
| fullnameOverride | string | `""` | Provide a name to substitute for the full names of resources |
| image | object | `{"debug":false,"pullPolicy":"Always","repository":"parity/polkadot","tag":"latest"}` | Image of Polkadot Node. |
| image.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| image.pullPolicy | string | `"Always"` | Image pull policy |
| image.repository | string | `"parity/polkadot"` | Image repository |
| image.tag | string | `"latest"` | Image tag |
| imagePullSecrets | list | `[]` | Reference to one or more secrets to be used when pulling images. ref: https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/ |
| ingress | object | `{"annotations":{},"enabled":false,"host":"chart-example.local","rules":[],"tls":[]}` | Creates an ingress resource |
| ingress.annotations | object | `{}` | Annotations to add to the Ingress |
| ingress.enabled | bool | `false` | Enable creation of Ingress |
| ingress.host | string | `"chart-example.local"` | hostname used for default rpc ingress rule, if .Values.ingress.rules is set host is not used. |
| ingress.rules | list | `[]` | Ingress rules configuration, empty = default rpc rule (send all requests to rps port) |
| ingress.tls | list | `[]` | Ingress TLS configuration |
| initContainers | object | `{"downloadChainSnapshot":{"cmdArgs":"","debug":false,"extraEnvVars":[],"image":{"repository":"docker.io/rclone/rclone","tag":"latest"},"resources":{}},"downloadChainspec":{"debug":false,"image":{"repository":"docker.io/alpine","tag":"latest"},"resources":{}},"downloadRuntime":{"debug":false,"image":{"repository":"paritytech/kubetools-kubectl","tag":"latest"},"resources":{}},"injectKeys":{"debug":false,"resources":{}},"persistGeneratedNodeKey":{"debug":false,"resources":{}},"retrieveServiceInfo":{"debug":false,"image":{"repository":"paritytech/kubetools-kubectl","tag":"latest"},"resources":{}}}` | Additional init containers |
| initContainers.downloadChainSnapshot.cmdArgs | string | `""` | Flags to add to the CLI command. We rely on rclone for downloading snapshots so make sure the flags are compatible. |
| initContainers.downloadChainSnapshot.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.downloadChainSnapshot.extraEnvVars | list | `[]` | Additional environment variables to add to the container |
| initContainers.downloadChainSnapshot.image | object | `{"repository":"docker.io/rclone/rclone","tag":"latest"}` | A container to use for downloading a node backup/snapshot |
| initContainers.downloadChainSnapshot.image.repository | string | `"docker.io/rclone/rclone"` | Image repository |
| initContainers.downloadChainSnapshot.image.tag | string | `"latest"` | Image tag |
| initContainers.downloadChainSnapshot.resources | object | `{}` | The resources requests/limits for the container |
| initContainers.downloadChainspec.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.downloadChainspec.image.repository | string | `"docker.io/alpine"` | Image repository |
| initContainers.downloadChainspec.image.tag | string | `"latest"` | Image tag |
| initContainers.downloadChainspec.resources | object | `{}` | Additional environment variables to add to the container |
| initContainers.downloadRuntime.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.downloadRuntime.image.repository | string | `"paritytech/kubetools-kubectl"` | Image repository |
| initContainers.downloadRuntime.image.tag | string | `"latest"` | Image tag |
| initContainers.downloadRuntime.resources | object | `{}` | Additional environment variables to add to the container |
| initContainers.injectKeys.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.injectKeys.resources | object | `{}` | Additional environment variables to add to the container |
| initContainers.persistGeneratedNodeKey.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.persistGeneratedNodeKey.resources | object | `{}` | Additional environment variables to add to the container |
| initContainers.retrieveServiceInfo | object | `{"debug":false,"image":{"repository":"paritytech/kubetools-kubectl","tag":"latest"},"resources":{}}` | A container to handle network configuration of the Polkadot node |
| initContainers.retrieveServiceInfo.debug | bool | `false` | Adds `-x` shell option to container. Note: passwords and keys used in container may appear in logs |
| initContainers.retrieveServiceInfo.image.repository | string | `"paritytech/kubetools-kubectl"` | Image repository |
| initContainers.retrieveServiceInfo.image.tag | string | `"latest"` | Image tag |
| initContainers.retrieveServiceInfo.resources | object | `{}` | The resources requests/limits for the container |
| jaegerAgent | object | `{"collector":{"port":14250,"url":null},"env":{},"image":{"repository":"jaegertracing/jaeger-agent","tag":"latest"},"ports":{"binaryPort":6832,"compactPort":6831,"samplingPort":5778},"resources":{}}` | Configuration of Jaeger agent https://github.com/jaegertracing/jaeger |
| jaegerAgent.collector | object | `{"port":14250,"url":null}` | Collector config |
| jaegerAgent.env | object | `{}` | Environment variables to set on the Jaeger sidecar |
| jaegerAgent.image.repository | string | `"jaegertracing/jaeger-agent"` | Image repository |
| jaegerAgent.image.tag | string | `"latest"` | Image tag |
| jaegerAgent.ports.binaryPort | int | `6832` | Accept jaeger.thrift over binary thrift protocol |
| jaegerAgent.ports.compactPort | int | `6831` | Accept jaeger.thrift over compact thrift protocol |
| jaegerAgent.ports.samplingPort | HTTP | `5778` | serve configs, sampling strategies |
| jaegerAgent.resources | object | `{}` | Resource limits & requests |
| nameOverride | string | `""` | Provide a name in place of node for `app:` labels |
| node | object | `{"allowUnsafeRpcMethods":false,"chain":"","chainData":{"annotations":{},"chainPath":null,"chainSnapshot":{"enabled":false,"filelistName":"files.txt","method":"gcs","url":""},"database":"rocksdb","ephemeral":{"enabled":false,"type":"emptyDir"},"kubernetesVolumeSnapshot":null,"kubernetesVolumeToClone":null,"pruning":1000,"storageClass":"","volumeSize":"100Gi"},"chainKeystore":{"accessModes":["ReadWriteOnce"],"annotations":{},"kubernetesVolumeSnapshot":null,"kubernetesVolumeToClone":null,"mountInMemory":{"enabled":false,"sizeLimit":null},"storageClass":"","volumeSize":"10Mi"},"collatorExternalRelayChain":{"enabled":false,"relayChainRpcUrls":[]},"collatorLightClient":{"enabled":false,"relayChain":"","relayChainCustomChainspec":false,"relayChainCustomChainspecPath":"/chain-data/relay_chain_chainspec.json","relayChainCustomChainspecUrl":null},"collatorRelayChain":{"chain":"polkadot","chainData":{"annotations":{},"chainPath":"","chainSnapshot":{"enabled":false,"filelistName":"files.txt","method":"gcs","url":""},"database":"rocksdb","ephemeral":{"enabled":false,"type":"emptyDir"},"kubernetesVolumeSnapshot":null,"kubernetesVolumeToClone":null,"pruning":1000,"storageClass":"","volumeSize":"100Gi"},"chainKeystore":{"accessModes":["ReadWriteOnce"],"annotations":{},"kubernetesVolumeSnapshot":null,"kubernetesVolumeToClone":null,"mountInMemory":{"enabled":false,"sizeLimit":null},"storageClass":"","volumeSize":"10Mi"},"customChainspec":false,"customChainspecPath":"/relaychain-data/relay_chain_chainspec.json","customChainspecUrl":null,"flags":[],"prometheus":{"enabled":false,"port":9625}},"command":"polkadot","customChainspec":false,"customChainspecPath":"/chain-data/chainspec.json","customChainspecUrl":null,"customNodeKey":[],"enableOffchainIndexing":false,"enableSidecarLivenessProbe":false,"enableSidecarReadinessProbe":false,"enableStartupProbe":true,"existingSecrets":{"extraDerivation":"","keys":[],"nodeKey":{}},"extraConfigmapMounts":[],"extraEnvVars":[],"extraSecretMounts":[],"flags":[],"forceDownloadChainspec":false,"isParachain":false,"keys":[],"legacyRpcFlags":false,"logLevels":[],"perNodeServices":{"apiService":{"annotations":{},"enabled":true,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"httpPort":9933,"prometheusPort":9615,"relayChainPrometheusPort":9625,"rpcPort":9944,"type":"ClusterIP","wsPort":9955},"paraP2pService":{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30334,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30335}},"relayP2pService":{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30333,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30334}},"setPublicAddressToExternalIp":{"autodiscoveryFix":false,"enabled":false,"ipRetrievalServiceUrl":"https://ifconfig.io"}},"persistGeneratedNodeKey":false,"persistentVolumeClaimRetentionPolicy":null,"podManagementPolicy":null,"prometheus":{"enabled":true,"port":9615},"replicas":1,"resources":{},"role":"full","serviceAnnotations":{},"serviceExtraPorts":[],"serviceMonitor":{"enabled":false,"interval":"30s","metricRelabelings":[],"namespace":null,"relabelings":[],"scrapeTimeout":"10s","targetLabels":["node"]},"startupProbeFailureThreshold":30,"substrateApiSidecar":{"enabled":false},"telemetryUrls":[],"tracing":{"enabled":false},"updateStrategy":{"enabled":false,"maxUnavailable":1,"type":"RollingUpdate"},"vault":{"authConfigServiceAccount":null,"authConfigType":null,"authPath":null,"authRole":null,"authType":null,"keys":{},"nodeKey":{}},"wasmRuntimeOverridesPath":"/chain-data/runtimes","wasmRuntimeUrl":""}` | Deploy a substrate node. ref: https://docs.substrate.io/tutorials/v3/private-network/ |
| node.allowUnsafeRpcMethods | bool | `false` | Allow executing unsafe RPC methods |
| node.chain | string | `""` | Name of the chain |
| node.chainData.annotations | object | `{}` | Annotations to add to the volumeClaimTemplates |
| node.chainData.chainPath | string | `nil` | Path on the volume to store chain data |
| node.chainData.chainSnapshot | object | `{"enabled":false,"filelistName":"files.txt","method":"gcs","url":""}` | Configure parameters for restoring chain snapshot. Uses [rclone](https://rclone.org/) |
| node.chainData.chainSnapshot.enabled | bool | `false` | Enable chain snapshot restoration |
| node.chainData.chainSnapshot.filelistName | string | `"files.txt"` | A remote file name containing names of DB file chunks. Appended to `url` |
| node.chainData.chainSnapshot.method | string | `"gcs"` | Restoration method. One of: gcs, s3, http-single-tar, http-single-tar-lz4, http-filelist |
| node.chainData.chainSnapshot.url | string | `""` | A URL to download chain backup |
| node.chainData.database | string | `"rocksdb"` | Database backend engine to use |
| node.chainData.ephemeral | object | `{"enabled":false,"type":"emptyDir"}` | Mount chain-data volume using an ephemeral volume ref: https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/#types-of-ephemeral-volumes |
| node.chainData.ephemeral.type | string | `"emptyDir"` | Type supports emptyDir, generic |
| node.chainData.kubernetesVolumeSnapshot | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.VolumeSnapshot) and use it to store chain data |
| node.chainData.kubernetesVolumeToClone | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.PersistentVolumeClaim) and use it to store chain data |
| node.chainData.pruning | int | `1000` | Set the amount of blocks to retain. If set to 0 archive node will be run. If deprecated `--pruning` flags is used in `node.flags`, set this to `false`. |
| node.chainData.storageClass | string | `""` | Storage class to use for persistent volume |
| node.chainData.volumeSize | string | `"100Gi"` | Size of the volume for chain data |
| node.chainKeystore | object | `{"accessModes":["ReadWriteOnce"],"annotations":{},"kubernetesVolumeSnapshot":null,"kubernetesVolumeToClone":null,"mountInMemory":{"enabled":false,"sizeLimit":null},"storageClass":"","volumeSize":"10Mi"}` | Configure chain keystore parameters |
| node.chainKeystore.accessModes | list | `["ReadWriteOnce"]` | Access mode of the volume |
| node.chainKeystore.annotations | object | `{}` | Annotations to add to the volumeClaimTemplates |
| node.chainKeystore.kubernetesVolumeSnapshot | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.VolumeSnapshot) and use it for the keystore |
| node.chainKeystore.kubernetesVolumeToClone | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.PersistentVolumeClaim) and use it for the keystore |
| node.chainKeystore.mountInMemory | object | `{"enabled":false,"sizeLimit":null}` | Mount chain keystore in memory using an emptyDir volume |
| node.chainKeystore.mountInMemory.enabled | bool | `false` | Enable mounting in-memory keystore |
| node.chainKeystore.mountInMemory.sizeLimit | string | `nil` | Size limit of the emptyDir holding a keystore. Requires K8s >=1.22 |
| node.chainKeystore.storageClass | string | `""` | Storage class to use for persistent volume |
| node.chainKeystore.volumeSize | string | `"10Mi"` | Size of the volume |
| node.collatorExternalRelayChain | object | `{"enabled":false,"relayChainRpcUrls":[]}` | EXPERIMENTAL!!! Run the collator node without a relay chain via external relay chain ref: https://github.com/paritytech/cumulus#external-relay-chain-node Enabling this option will disable the values of collatorRelayChain |
| node.collatorExternalRelayChain.enabled | bool | `false` | Enable deployment of the external collator |
| node.collatorExternalRelayChain.relayChainRpcUrls | list | `[]` | List of Relay Chain RPCs to connect |
| node.collatorLightClient | object | `{"enabled":false,"relayChain":"","relayChainCustomChainspec":false,"relayChainCustomChainspecPath":"/chain-data/relay_chain_chainspec.json","relayChainCustomChainspecUrl":null}` | EXPERIMENTAL!!! Run the collator node without a relay chain via light client ref: https://github.com/paritytech/cumulus/pull/2270 Enabling this option will disable the values of collatorRelayChain |
| node.collatorLightClient.enabled | bool | `false` | Enable deployment of the external collator |
| node.collatorLightClient.relayChain | string | `""` | Name of the Relay Chain to connect |
| node.collatorLightClient.relayChainCustomChainspec | bool | `false` | Use the file defined in `collatorLightClient.relayChainCustomChainspecPath` as the chainspec. Ensure that the file is either mounted or generated with an init container. |
| node.collatorLightClient.relayChainCustomChainspecPath | string | `"/chain-data/relay_chain_chainspec.json"` | Path to the file containing the chainspec of the collator relay-chain |
| node.collatorLightClient.relayChainCustomChainspecUrl | string | `nil` | URL to retrive custom chain spec |
| node.collatorRelayChain.chain | string | `"polkadot"` | Name of the Relay Chain to connect |
| node.collatorRelayChain.chainData.annotations | object | `{}` | Annotations to add to the volumeClaimTemplates |
| node.collatorRelayChain.chainData.chainPath | string | `""` | Path on the volume to store chain data |
| node.collatorRelayChain.chainData.chainSnapshot | object | `{"enabled":false,"filelistName":"files.txt","method":"gcs","url":""}` | Configure parameters for restoring relay chain snapshot. Uses [rclone](https://rclone.org/) |
| node.collatorRelayChain.chainData.chainSnapshot.enabled | bool | `false` | Enable relay chain snapshot restoration |
| node.collatorRelayChain.chainData.chainSnapshot.filelistName | string | `"files.txt"` | A remote file name containing names of DB file chunks. Appended to `url` |
| node.collatorRelayChain.chainData.chainSnapshot.method | string | `"gcs"` | Restoration method. One of: gcs, s3, http-single-tar, http-single-tar-lz4, http-filelist |
| node.collatorRelayChain.chainData.chainSnapshot.url | string | `""` | A URL to download chain backup |
| node.collatorRelayChain.chainData.database | string | `"rocksdb"` | Database backend engine to use for the collator relay-chain database |
| node.collatorRelayChain.chainData.ephemeral | object | `{"enabled":false,"type":"emptyDir"}` | Mount relaychain-data volume using an ephemeral volume ref: https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/#types-of-ephemeral-volumes |
| node.collatorRelayChain.chainData.ephemeral.type | string | `"emptyDir"` | Type supports emptyDir, generic |
| node.collatorRelayChain.chainData.kubernetesVolumeSnapshot | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.VolumeSnapshot) and use it to store relay-chain data |
| node.collatorRelayChain.chainData.kubernetesVolumeToClone | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.PersistentVolumeClaim) and use it to store relay-chain data |
| node.collatorRelayChain.chainData.pruning | int | `1000` | Set the amount of blocks to retain for the collator relay-chain database. If set to 0 archive node will be run. If deprecated `--pruning` flags is used in `node.collatorRelayChain.flags`, set this to `false`. |
| node.collatorRelayChain.chainData.storageClass | string | `""` | Storage class to use for persistent volume |
| node.collatorRelayChain.chainData.volumeSize | string | `"100Gi"` | Size of the volume |
| node.collatorRelayChain.chainKeystore.accessModes | list | `["ReadWriteOnce"]` | Access mode of the volume |
| node.collatorRelayChain.chainKeystore.annotations | object | `{}` | Annotations to add to the volumeClaimTemplates |
| node.collatorRelayChain.chainKeystore.kubernetesVolumeSnapshot | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.VolumeSnapshot) and use it for the keystore |
| node.collatorRelayChain.chainKeystore.kubernetesVolumeToClone | string | `nil` | If set, create a clone of the volume (using volumeClaimTemplates.dataSource.PersistentVolumeClaim) and use it for the keystore |
| node.collatorRelayChain.chainKeystore.mountInMemory | object | `{"enabled":false,"sizeLimit":null}` | Mount relay-chain keystore in memory using an emptyDir volume |
| node.collatorRelayChain.chainKeystore.mountInMemory.enabled | bool | `false` | Enable mounting in-memory keystore |
| node.collatorRelayChain.chainKeystore.mountInMemory.sizeLimit | string | `nil` | Size limit of the emptyDir holding a keystore. Requires K8s >=1.22 |
| node.collatorRelayChain.chainKeystore.storageClass | string | `""` | Storage class to use for persistent volume |
| node.collatorRelayChain.chainKeystore.volumeSize | string | `"10Mi"` | Size of the volume |
| node.collatorRelayChain.customChainspec | bool | `false` | Use the file defined in `collatorRelayChain.customChainspecPath` as the chainspec. Ensure that the file is either mounted or generated with an init container. |
| node.collatorRelayChain.customChainspecPath | string | `"/relaychain-data/relay_chain_chainspec.json"` | Path to the file containing the chainspec of the collator relay-chain Set to /relaychain-data to use additional volume |
| node.collatorRelayChain.customChainspecUrl | string | `nil` | URL to retrive custom chain spec |
| node.collatorRelayChain.flags | list | `[]` | Flags to add to the Polkadot binary |
| node.collatorRelayChain.prometheus | object | `{"enabled":false,"port":9625}` | Expose relay chain metrics via Prometheus format in /metrics endpoint. Passes the following args to the Polkadot binary:   - "--prometheus-external" \   - "--prometheus-port {{ port }}" |
| node.collatorRelayChain.prometheus.enabled | bool | `false` | Expose Prometheus metrics |
| node.collatorRelayChain.prometheus.port | int | `9625` | The port for exposed Prometheus metrics |
| node.command | string | `"polkadot"` | Command to run within the container |
| node.customChainspec | bool | `false` | Use the file defined in `node.customChainspecPath` as the chainspec. Ensure that the file is either mounted or generated with an init container. |
| node.customChainspecPath | string | `"/chain-data/chainspec.json"` | Node may require custom name for chainspec file. ref:  moonbeam https://github.com/PureStake/moonbeam/issues/1104#issuecomment-996787548 Note: path should start with /chain-data/ since this folder mount in init container download-chainspec. |
| node.customChainspecUrl | string | `nil` | URL to retrive custom chain spec |
| node.customNodeKey | list | `[]` | List of custom node key(s) for all pods in the StatefulSet Alternatively, use `.seed` to derive node key(s). |
| node.enableOffchainIndexing | bool | `false` | Enable Offchain Indexing. https://docs.substrate.io/fundamentals/offchain-operations/ |
| node.enableSidecarLivenessProbe | bool | `false` | Enable Node liveness probe through `paritytech/ws-health-exporter` running as a sidecar container |
| node.enableSidecarReadinessProbe | bool | `false` | Enable Node readiness probe through `paritytech/ws-health-exporter` running as a sidecar container |
| node.enableStartupProbe | bool | `true` | Enable Node container's startup probe |
| node.existingSecrets | object | `{"extraDerivation":"","keys":[],"nodeKey":{}}` | Inject keys from already existing Kubernetes secrets |
| node.existingSecrets.keys | list | `[]` | List of kubernetes secret names to be added to the keystore. Each secret should contain 3 keys: type, scheme and seed Secret example: templates/keys.yaml Supercedes node.vault.keys |
| node.existingSecrets.nodeKey | object | `{}` | K8s secret with node key Secret example: templates/customNodeKeySecret.yaml Supercedes node.vault.nodeKey |
| node.extraConfigmapMounts | list | `[]` | Mount already existing ConfigMaps into the main container. https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/#populate-a-volume-with-data-stored-in-a-configmap |
| node.extraEnvVars | list | `[]` | Environment variables to set for the main container: |
| node.extraSecretMounts | list | `[]` | Mount already existing k8s Secrets into main container. https://kubernetes.io/docs/concepts/configuration/secret/#using-secrets-as-files-from-a-pod NOTE: This is NOT used to inject keys to the keystore or add node key. |
| node.flags | list | `[]` | Flags to add to the Polkadot binary |
| node.forceDownloadChainspec | bool | `false` | Replace chain spec if it already exists |
| node.isParachain | bool | `false` | Deploy a collator node. ref: https://wiki.polkadot.network/docs/learn-collator If Collator is enabled, collator image must be used |
| node.keys | list | `[]` | Keys to use by the node. ref: https://wiki.polkadot.network/docs/learn-keys |
| node.legacyRpcFlags | bool | `false` | Use deprecated ws/rpc flags. ref: https://github.com/paritytech/substrate/pull/13384 |
| node.logLevels | list | `[]` | Log level |
| node.perNodeServices | object | `{"apiService":{"annotations":{},"enabled":true,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"httpPort":9933,"prometheusPort":9615,"relayChainPrometheusPort":9625,"rpcPort":9944,"type":"ClusterIP","wsPort":9955},"paraP2pService":{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30334,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30335}},"relayP2pService":{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30333,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30334}},"setPublicAddressToExternalIp":{"autodiscoveryFix":false,"enabled":false,"ipRetrievalServiceUrl":"https://ifconfig.io"}}` | Configuration of individual services of the node |
| node.perNodeServices.apiService.annotations | object | `{}` | Annotations to add to the Service |
| node.perNodeServices.apiService.enabled | bool | `true` | If enabled, generic service to expose common node APIs |
| node.perNodeServices.apiService.externalDns | object | `{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300}` | External DNS configuration ref: https://github.com/kubernetes-sigs/external-dns |
| node.perNodeServices.apiService.externalDns.customPrefix | string | `""` | Custom prefix to use instead of prefixing the hostname with the name of the Pod |
| node.perNodeServices.apiService.externalDns.enabled | bool | `false` | Enable External DNS |
| node.perNodeServices.apiService.externalDns.hostname | string | `"example.com"` | External DNS hostname |
| node.perNodeServices.apiService.externalDns.ttl | int | `300` | DNS record TTL |
| node.perNodeServices.apiService.externalTrafficPolicy | string | `"Cluster"` | Traffic policy |
| node.perNodeServices.apiService.extraPorts | list | `[]` | Additional ports on per node Services |
| node.perNodeServices.apiService.httpPort | int | `9933` | deprecated, use rpcPort |
| node.perNodeServices.apiService.prometheusPort | int | `9615` | Prometheus port |
| node.perNodeServices.apiService.relayChainPrometheusPort | int | `9625` | Relay chains Prometheus port |
| node.perNodeServices.apiService.rpcPort | int | `9944` | Port of the RPC endpoint |
| node.perNodeServices.apiService.type | string | `"ClusterIP"` | Service type |
| node.perNodeServices.apiService.wsPort | int | `9955` | deprecated, use rpcPort |
| node.perNodeServices.paraP2pService | object | `{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30334,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30335}}` | If enabled, create service to expose parachain P2P |
| node.perNodeServices.paraP2pService.annotations | object | `{}` | Annotations to add to the Service |
| node.perNodeServices.paraP2pService.enabled | bool | `false` | Enable exposing parachain P2P Service |
| node.perNodeServices.paraP2pService.externalDns | object | `{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300}` | External DNS configuration ref: https://github.com/kubernetes-sigs/external-dns |
| node.perNodeServices.paraP2pService.externalDns.customPrefix | string | `""` | Custom prefix to use instead of prefixing the hostname with the name of the Pod |
| node.perNodeServices.paraP2pService.externalDns.enabled | bool | `false` | Enable External DNS |
| node.perNodeServices.paraP2pService.externalDns.hostname | string | `"example.com"` | External DNS hostname |
| node.perNodeServices.paraP2pService.externalDns.ttl | int | `300` | DNS record TTL |
| node.perNodeServices.paraP2pService.externalTrafficPolicy | string | `"Cluster"` | Traffic policy |
| node.perNodeServices.paraP2pService.extraPorts | list | `[]` | Additional ports on per node Services |
| node.perNodeServices.paraP2pService.port | int | `30334` | Port of the P2P endpoint (parachain) |
| node.perNodeServices.paraP2pService.publishUnreadyAddresses | bool | `true` | Publish the P2P port even if the pod is not ready (e.g., node is syncing). It's recommended to keep this to true. |
| node.perNodeServices.paraP2pService.type | string | `"NodePort"` | Service type |
| node.perNodeServices.paraP2pService.ws.enabled | bool | `false` | If enabled, additionally expose WebSocket port. Useful for bootnodes |
| node.perNodeServices.paraP2pService.ws.port | int | `30335` | WS port |
| node.perNodeServices.relayP2pService | object | `{"annotations":{},"enabled":false,"externalDns":{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300},"externalTrafficPolicy":"Cluster","extraPorts":[],"port":30333,"publishUnreadyAddresses":true,"type":"NodePort","ws":{"enabled":false,"port":30334}}` | If enabled, create service to expose relay chain P2P |
| node.perNodeServices.relayP2pService.annotations | object | `{}` | Annotations to add to the Service |
| node.perNodeServices.relayP2pService.externalDns | object | `{"customPrefix":"","enabled":false,"hostname":"example.com","ttl":300}` | External DNS configuration ref: https://github.com/kubernetes-sigs/external-dns |
| node.perNodeServices.relayP2pService.externalDns.customPrefix | string | `""` | Custom prefix to use instead of prefixing the hostname with the name of the Pod |
| node.perNodeServices.relayP2pService.externalDns.enabled | bool | `false` | Enable External DNS |
| node.perNodeServices.relayP2pService.externalDns.hostname | string | `"example.com"` | External DNS hostname |
| node.perNodeServices.relayP2pService.externalDns.ttl | int | `300` | DNS record TTL |
| node.perNodeServices.relayP2pService.externalTrafficPolicy | string | `"Cluster"` | Traffic policy |
| node.perNodeServices.relayP2pService.extraPorts | list | `[]` | Additional ports on per node Services |
| node.perNodeServices.relayP2pService.port | int | `30333` | Port of the P2P endpoint (relay chain) |
| node.perNodeServices.relayP2pService.publishUnreadyAddresses | bool | `true` | Publish the P2P port even if the pod is not ready (e.g., node is syncing). It's recommended to keep this to true. |
| node.perNodeServices.relayP2pService.type | string | `"NodePort"` | Service type |
| node.perNodeServices.relayP2pService.ws.enabled | bool | `false` | If enabled, additionally expose WebSocket port. Useful for bootnodes |
| node.perNodeServices.relayP2pService.ws.port | int | `30334` | WS port |
| node.perNodeServices.setPublicAddressToExternalIp.autodiscoveryFix | bool | `false` | EXPERIMENTAL!!! libp2p autodiscovery uses the external IP and port from --listen-addr instead of --public-addr. This flag will set the service port as an additional --listen-addr. |
| node.perNodeServices.setPublicAddressToExternalIp.enabled | bool | `false` | If enabled, set `--public-addr` flag to be the NodePort p2p services external address |
| node.perNodeServices.setPublicAddressToExternalIp.ipRetrievalServiceUrl | string | `"https://ifconfig.io"` | Web service to use for public IP retrieval |
| node.persistGeneratedNodeKey | bool | `false` | If enabled, generate a persistent volume to use for the keys |
| node.persistentVolumeClaimRetentionPolicy | string | `nil` | Persistent volume claim retention policy of stateful set (ie. whether to retain or delete the attached PVCs when scaling down or deleting the stateful set). ref: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#persistentvolumeclaim-retention |
| node.podManagementPolicy | string | `nil` | Pod management policy of stateful set. ref: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#pod-management-policies |
| node.prometheus | object | `{"enabled":true,"port":9615}` | Expose metrics via Prometheus format in /metrics endpoint. Passes the following args to the Polkadot binary:   - "--prometheus-external" \   - "--prometheus-port {{ .Values.node.prometheus.port }}" |
| node.prometheus.enabled | bool | `true` | Expose Prometheus metrics |
| node.prometheus.port | int | `9615` | The port for exposed Prometheus metrics |
| node.replicas | int | `1` | Number of replicas to deploy |
| node.resources | object | `{}` | Resource limits & requests |
| node.role | string | `"full"` | Type of the node. One of: full, authority, validator, collator, light |
| node.serviceAnnotations | object | `{}` | Annotations to add to the Service |
| node.serviceExtraPorts | list | `[]` | Additional ports on main Service |
| node.serviceMonitor | object | `{"enabled":false,"interval":"30s","metricRelabelings":[],"namespace":null,"relabelings":[],"scrapeTimeout":"10s","targetLabels":["node"]}` | Service Monitor of Prometheus-Operator ref: https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/user-guides/getting-started.md#include-servicemonitors |
| node.serviceMonitor.enabled | bool | `false` | Enables Service Monitor |
| node.serviceMonitor.interval | string | `"30s"` | Scrape interval |
| node.serviceMonitor.metricRelabelings | list | `[]` | Metric relabelings config |
| node.serviceMonitor.namespace | string | `nil` | Namespace to deploy Service Monitor. If not set deploys in the same namespace with the chart |
| node.serviceMonitor.relabelings | list | `[]` | Relabelings config |
| node.serviceMonitor.scrapeTimeout | string | `"10s"` | Scrape timeout |
| node.serviceMonitor.targetLabels | list | `["node"]` | Labels to scrape |
| node.startupProbeFailureThreshold | int | `30` | On startup, the number of attempts to check the probe before restarting the pod |
| node.substrateApiSidecar.enabled | bool | `false` | Enable Sustrate API as a sidecar |
| node.telemetryUrls | list | `[]` | URLs to send telemetry data |
| node.tracing.enabled | bool | `false` | Enable Jaeger Agent as a sidecar |
| node.updateStrategy | object | `{"enabled":false,"maxUnavailable":1,"type":"RollingUpdate"}` | How node updates should be applied. |
| node.updateStrategy.enabled | bool | `false` | Enable custom updateStrategy |
| node.updateStrategy.maxUnavailable | int | `1` | Can be an int or a % |
| node.updateStrategy.type | string | `"RollingUpdate"` | Type supports RollingUpdate or OnDelete |
| node.vault | object | `{"authConfigServiceAccount":null,"authConfigType":null,"authPath":null,"authRole":null,"authType":null,"keys":{},"nodeKey":{}}` | Component to inject secrets via annotation of Hashicorp Vault ref: https://www.vaultproject.io/docs/platform/k8s/injector/annotations |
| node.vault.authConfigServiceAccount | string | `nil` | Configures auth-config-service-account annotation |
| node.vault.authConfigType | string | `nil` | Configures auth-config-type annotations |
| node.vault.authPath | string | `nil` | Configures the authentication path for the Kubernetes auth method |
| node.vault.authRole | string | `nil` | Configures the Vault role used by the Vault Agent auto-auth method. |
| node.vault.authType | string | `nil` | Configures the authentication type for Vault Agent. For a list of valid authentication methods, see the Vault Agent auto-auth documentation. |
| node.vault.keys | object | `{}` | Keys to fetch from Hashicorp Vault and set on the node |
| node.vault.nodeKey | object | `{}` | Node key to use via vault |
| node.wasmRuntimeOverridesPath | string | `"/chain-data/runtimes"` | Define the WASM runtime overrides directory path |
| node.wasmRuntimeUrl | string | `""` | Download a WASM runtime to override the on-chain runtime when the version matches. Note that this will download the runtime file in the directory specified in `node.wasmRuntimeOverridesPath` Then on startup, the node will load all runtime files from this directory including previously downloaded runtimes |
| nodeSelector | object | `{}` | Define which Nodes the Pods are scheduled on |
| podAnnotations | object | `{}` | Annotations to add to the Pod |
| podDisruptionBudget | object | `{"enabled":false,"maxUnavailable":null,"minAvailable":null}` | podDisruptionBudget configuration |
| podDisruptionBudget.enabled | bool | `false` | Enable podDisruptionBudget |
| podDisruptionBudget.maxUnavailable | string | `nil` | maxUnavailable replicas |
| podDisruptionBudget.minAvailable | string | `nil` | minAvailable replicas |
| podSecurityContext | object | `{"fsGroup":1000,"runAsGroup":1000,"runAsUser":1000}` | SecurityContext holds pod-level security attributes and common container settings. This defaults to non root user with uid 1000 and gid 1000. ref: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/ |
| podSecurityContext.fsGroup | int | `1000` | Set container's Security Context fsGroup |
| podSecurityContext.runAsGroup | int | `1000` | Set container's Security Context runAsGroup |
| podSecurityContext.runAsUser | int | `1000` | Set container's Security Context runAsUser |
| priorityClassName | string | `""` | pods' priorityClassName |
| schedulerName | string | `""` | Name of the k8s scheduler (other than default) ref: https://kubernetes.io/docs/tasks/administer-cluster/configure-multiple-schedulers/ |
| serviceAccount | object | `{"annotations":{},"create":true,"createRoleBinding":true,"name":""}` | Service account for the node to use. ref: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/ |
| serviceAccount.annotations | object | `{}` | Annotations to add to the Service Account |
| serviceAccount.create | bool | `true` | Enable creation of a Service Account for the main container |
| serviceAccount.createRoleBinding | bool | `true` | Creates RoleBinding |
| serviceAccount.name | string | `""` | The name of the service account to use. If not set and create is true, a name is generated using the fullname template |
| substrateApiSidecar | object | `{"args":["node","build/src/main.js"],"env":{},"image":{"repository":"parity/substrate-api-sidecar","tag":"latest"},"metrics":{"enabled":false,"port":9100},"resources":{}}` | Configuration of Substrate API ref: https://github.com/paritytech/substrate-api-sidecar |
| substrateApiSidecar.args | list | `["node","build/src/main.js"]` | Arguments to set on the API sidecar |
| substrateApiSidecar.env | object | `{}` | Environment variables to set on the API sidecar |
| substrateApiSidecar.image.repository | string | `"parity/substrate-api-sidecar"` | Image repository |
| substrateApiSidecar.image.tag | string | `"latest"` | Image tag |
| substrateApiSidecar.resources | object | `{}` | Resource limits & requests |
| terminationGracePeriodSeconds | int | `60` | Grace termination period of the Pod |
| tolerations | list | `[]` | Tolerations for use with node taints |
| topologySpreadConstraints | object | `{}` | Topology Spread Constraints for pod assignment spread across your cluster among failure-domains. Evaluated as a template Ref: https://kubernetes.io/docs/concepts/workloads/pods/pod-topology-spread-constraints/#spread-constraints-for-pods |
| wsHealthExporter | object | `{"env":{},"image":{"repository":"paritytech/ws-health-exporter","tag":"99611363-20240306"},"resources":{}}` | Configuration of the WS Health exporter. ref: https://github.com/paritytech/scripts/tree/master/dockerfiles/ws-health-exporter |
| wsHealthExporter.env | object | `{}` | Environment variables to set on the API sidecar |
| wsHealthExporter.image.repository | string | `"paritytech/ws-health-exporter"` | Image repository |
| wsHealthExporter.image.tag | string | `"99611363-20240306"` | Image tag |
| wsHealthExporter.resources | object | `{}` | Resource limits & requests |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.12.0](https://github.com/norwoodj/helm-docs/releases/v1.12.0)
