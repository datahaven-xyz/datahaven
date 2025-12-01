version := v0.1.2

# generate-ethereum-state:
# #	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "apt update && apt install -y wget"
# #	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "wget https://github.com/undercover-cactus/Chaos/releases/download/${version}/chaos-linux-amd64-${version}.tar.gz"
# 	docker cp chaos-linux-amd64-${version}.tar.gz $(shell docker ps -aq --filter name='el-1-reth'):chaos-linux-amd64-${version}.tar.gz
# 	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "tar -xzvf chaos-linux-amd64-${version}.tar.gz"
# 	docker exec $(shell docker ps -aq --filter name='el-1-reth') bash -c "./target/release/chaos --database-path /data/reth/execution-data/db"
# 	docker cp $(shell docker ps -aq --filter name='el-1-reth'):state.json ../contracts/deployments/state-diff.json

generate-ethereum-state:
	docker cp $(shell docker ps -aq --filter name='el-1-reth'):/data/reth/execution-data/db /tmp/db
	wget https://github.com/undercover-cactus/Chaos/releases/download/${version}/chaos-linux-amd64-${version}.tar.gz -O /tmp/chaos.tar.gz
	tar -xzvf /tmp/chaos.tar.gz -C /tmp/
	/tmp/target/release/chaos --database-path /tmp/db
	mv state.json ../contracts/deployments/state-diff.json