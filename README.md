# DataHaven 🫎

An EVM compatible Substrate chain, powered by StorageHub and secured by EigenLayer.

## Repo Structure

```bash
datahaven/
├── .github/ # GitHub Actions workflows.
├── contracts/ # Implementation of the DataHaven AVS (Autonomous Verifiable Service) smart contracts to interact with EigenLayer.
├── docker/ # Docker build files.
├── operator/ # DataHaven node based on Substrate. The "Operator" in EigenLayer terms.
├── test/ # Integration tests for the AVS and Operator.
├── resources/ # Miscellaneous resources for the DataHaven project.
└── README.md
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