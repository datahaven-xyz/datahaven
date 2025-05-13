# DataHaven 🫎

An EVM compatible Substrate chain, powered by StorageHub and secured by EigenLayer.

## Repo Structure

```bash
datahaven/
├── .github/ # GitHub Actions workflows.
├── contracts/ # Implementation of the DataHaven AVS (Autonomous Verifiable Service) smart contracts to interact with EigenLayer.
├── operator/ # DataHaven node based on Substrate. The "Operator" in EigenLayer terms.
├── test/ # Integration tests for the AVS and Operator.
├── resources/ # Miscellaneous resources for the DataHaven project.
└── README.md
```

## Docker

This repo publishes images to [DockerHub](https://hub.docker.com/r/moonsonglabs/datahaven).

> [!TIP]  
>
> If you cannot see this repo you must be added to the permission list for the private repo.

To aid with speed it employs the following:

- [sccache](https://github.com/mozilla/sccache/tree/main): De-facto caching tool to speed up rust builds.
- [cargo chef](https://lpalmieri.com/posts/fast-rust-docker-builds/): A method of caching building the dependencies as a docker layer to cut down compilation times.
- [buildx cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts): Using buildx's new feature to mount an externally restored cache into a container.
- [cache dance](https://github.com/reproducible-containers/buildkit-cache-dance): Weird workaround (endorsed by docker themselves) to inject caches into containers and return the result back to the CI.

To run a docker image locally (`moonsonglabs/datahaven:local`), from the `/test` folder run:

```sh
bun build:docker:operator
```

## CI

Using the [act](https://github.com/nektos/act) binary, you can run GitHub Actions locally.

For example, to run the entire `e2e` workflow:

```bash
act -W .github/workflows/e2e.yml -s GITHUB_TOKEN="$(gh auth token)"
```

Which results in:

```bash
INFO[0000] Using docker host 'unix:///var/run/docker.sock', and daemon socket 'unix:///var/run/docker.sock'
INFO[0000] Start server on http://192.168.1.97:34567
[E2E - Kurtosis Deploy and Verify/kurtosis] ⭐ Run Set up job
[E2E - Kurtosis Deploy and Verify/kurtosis] 🚀  Start image=catthehacker/ubuntu:rust-24.04
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker pull image=catthehacker/ubuntu:rust-24.04 platform= username= forcePull=true
[E2E - Kurtosis Deploy and Verify/kurtosis] using DockerAuthConfig authentication for docker pull
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker create image=catthehacker/ubuntu:rust-24.04 platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker run image=catthehacker/ubuntu:rust-24.04 platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[E2E - Kurtosis Deploy and Verify/kurtosis]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Set up job
[E2E - Kurtosis Deploy and Verify/kurtosis]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
...
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Post Install Foundry [212.864597ms]
[E2E - Kurtosis Deploy and Verify/kurtosis] ⭐ Run Complete job
[E2E - Kurtosis Deploy and Verify/kurtosis] Cleaning up container for job kurtosis
[E2E - Kurtosis Deploy and Verify/kurtosis]   ✅  Success - Complete job
[E2E - Kurtosis Deploy and Verify/kurtosis] 🏁  Job succeeded
```
