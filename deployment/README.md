# DataHaven Helm charts

## DataHaven Bootnode & Validators

### Deploy

```sh
cd deployment/charts/node
helm upgrade --install dh-bootnode  . -f ./datahaven/dh-bootnode.yaml -n kt-datahaven-stagenet
helm upgrade --install dh-validator  . -f ./datahaven/dh-validator.yaml -n kt-datahaven-stagenet
```

### Access validator node with Polkadot.js apps

```sh
kubectl port-forward svc/dh-validator-0 -n kt-datahaven-stagenet 9955:9955
https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9955#/explorer
```

### Remove

```sh
helm uninstall dh-bootnode -n kt-datahaven-stagenet
helm uninstall dh-validator -n kt-datahaven-stagenet
```

### Cleanup volumes

```sh
kubectl delete pvc -l app.kubernetes.io/instance=dh-bootnode -n kt-datahaven-stagenet
kubectl delete pvc -l app.kubernetes.io/instance=dh-validator -n kt-datahaven-stagenet
```

## Snowbridge Relayers

### Create secrets

```sh
kubectl create secret generic dh-beefy-relay-ethereum-key --from-literal=pvk="<PRIVATE_KEY>" -n kt-datahaven-stagenet
kubectl create secret generic dh-beacon-relay-substrate-key --from-literal=pvk="<PRIVATE_KEY>" -n kt-datahaven-stagenet
kubectl create secret generic dh-execution-relay-substrate-key --from-literal=pvk="<PRIVATE_KEY>" -n kt-datahaven-stagenet
```

### Deploy

```sh
helm upgrade --install dh-beacon-relay . -f ./snowbridge/dh-beacon-relay.yaml -n kt-datahaven-stagenet
helm upgrade --install dh-beefy-relay . -f ./snowbridge/dh-beefy-relay.yaml -n kt-datahaven-stagenet
helm upgrade --install dh-execution-relay . -f ./snowbridge/dh-execution-relay.yaml -n kt-datahaven-stagenet
```

## Remove

```sh
helm uninstall dh-beacon-relay -n kt-datahaven-stagenet
helm uninstall dh-beefy-relay -n kt-datahaven-stagenet
helm uninstall dh-execution-relay -n kt-datahaven-stagenet
```

### Delete secrets

```sh
kubectl delete secret <secret_name> -n kt-datahaven-stagenet
```
