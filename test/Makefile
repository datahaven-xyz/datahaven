generate:
	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "apt update && apt install -y wget"
	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "wget https://github.com/undercover-cactus/Chaos/releases/download/v0.1.1/chaos-linux-amd64-v0.1.1.tar.gz"
	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "tar -xzvf chaos-linux-amd64-v0.1.1.tar.gz"
	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "./target/release/chaos --database-path /data/reth/execution-data/db"
	docker cp $(shell docker ps -aq --filter name='el-1-reth'):state.json ../contracts/deployments/state-diff.json