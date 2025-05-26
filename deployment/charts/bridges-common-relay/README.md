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

# Parity Bridges Common helm chart

![Version: 1.1.1](https://img.shields.io/badge/Version-1.1.1-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)

This helm chart installs [Parity Bridges Common](https://github.com/paritytech/parity-bridges-common) relayer.

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Parity | <devops+helm@parity.io> | <https://github.com/paritytech/helm-charts> |

## Installing the chart

```console
helm repo add parity https://paritytech.github.io/helm-charts/
helm install bridges-common-relay parity/bridges-common-relay
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | Assign custom affinity rules |
| env | object | `{}` | Set environment variables |
| existingSecretName | string | `""` | Override secrets with already existing secret name. |
| extraArgs | list | `[]` | Set extra command line arguments |
| extraLabels | object | `{}` | Additional common labels on pods and services |
| fullnameOverride | string | `""` | Provide a name to substitute for the full names of resources |
| image.pullPolicy | string | `"Always"` | Image pull policy |
| image.repository | string | `"paritytech/substrate-relay"` | Image repository |
| image.tag | string | `"latest"` | Image tag |
| imagePullSecrets | list | `[]` | Reference to one or more secrets to be used when pulling images. ref: https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/ |
| nameOverride | string | `""` | Provide a name in place of node for `app:` labels |
| nodeSelector | object | `{}` | Define which Nodes the Pods are scheduled on |
| params | list | `[]` |  |
| podAnnotations | object | `{}` | Annotations to add to the Pod |
| podSecurityContext | object | `{}` | SecurityContext holds pod-level security attributes and common container settings. ref: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/ |
| prometheus | object | `{"enabled":false,"port":9615}` | Expose metrics via Prometheus format in /metrics endpoint. |
| prometheus.enabled | bool | `false` | Expose Prometheus metrics |
| prometheus.port | int | `9615` | The port for exposed Prometheus metrics |
| replicaCount | int | `1` |  |
| resources | object | `{}` | Resource limits & requests |
| rewards | object | `{}` | CronJobs to automatically claim relayer rewards |
| secrets | object | `{}` | Secrets will be mounted to pod /secrets/{key} |
| securityContext | object | `{}` | SecurityContext holds pod-level security attributes and common container settings. |
| service | object | `{"port":80,"type":"ClusterIP"}` | Service |
| service.port | int | `80` | Service port |
| service.type | string | `"ClusterIP"` | Service type |
| serviceAccount | object | `{"annotations":{},"create":true,"name":""}` | Service account for the node to use. ref: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/ |
| serviceAccount.annotations | object | `{}` | Annotations to add to the Service Account |
| serviceAccount.create | bool | `true` | Enable creation of a Service Account for the main container |
| serviceAccount.name | string | `""` | Service Account name |
| serviceMonitor | object | `{"enabled":false,"interval":"30s","metricRelabelings":[],"namespace":null,"relabelings":[],"scrapeTimeout":"10s","targetLabels":["node"]}` | Service Monitor of Prometheus-Operator ref: https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/user-guides/getting-started.md#include-servicemonitors |
| serviceMonitor.enabled | bool | `false` | Enables Service Monitor |
| serviceMonitor.interval | string | `"30s"` | Scrape interval |
| serviceMonitor.metricRelabelings | list | `[]` | Metric relabelings config |
| serviceMonitor.namespace | string | `nil` | Namespace to deploy Service Monitor. If not set deploys in the same namespace with the chart |
| serviceMonitor.relabelings | list | `[]` | Relabelings config |
| serviceMonitor.scrapeTimeout | string | `"10s"` | Scrape timeout |
| serviceMonitor.targetLabels | list | `["node"]` | Labels to scrape |
| tolerations | list | `[]` | Tolerations for use with node taints |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.12.0](https://github.com/norwoodj/helm-docs/releases/v1.12.0)
