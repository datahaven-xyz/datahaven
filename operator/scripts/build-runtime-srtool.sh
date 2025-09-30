
# CARGO_NET_GIT_FETCH_WITH_CLI=true and --entrypoint /srtool/entrypoint.sh
# are required to allow srtool to fetch from github private repositories

# self-hosted runner uses user `maintenance` to match srtool `builder` user 1001
# $(~/srtool/uid-gid-mapping.sh 1001 | xargs) is used to map the user and group

# Docker command to generate JSON blob of the runtime
CMD="docker run \
  -i \
  --rm \
  -e CARGO_NET_GIT_FETCH_WITH_CLI=true \
  -e PACKAGE=${GH_WORKFLOW_MATRIX_CHAIN}-runtime \
  -e RUNTIME_DIR=runtime/${GH_WORKFLOW_MATRIX_CHAIN} \
  -e BUILD_OPTS=${RUNTIME_BUILD_OPTS} \
  -e PROFILE=${RUNTIME_BUILD_PROFILE} \
  -e WASM_BUILD_STD=0 \
  -v ${PWD}:/build \
  ${GH_WORKFLOW_MATRIX_SRTOOL_IMAGE}:${GH_WORKFLOW_MATRIX_SRTOOL_IMAGE_TAG} \
    build --app --json -cM"

# Here we run the command and stream the output (JSON blob) to a variable
stdbuf -oL $CMD | {
  while IFS= read -r line
  do
      echo ║ $line
      JSON="$line"
  done

  echo "json=$JSON" >> $GITHUB_OUTPUT

  PROP=`echo $JSON | jq -r .runtimes.compact.prop`
  echo "proposal_hash=$PROP" >> $GITHUB_OUTPUT

  WASM=`echo $JSON | jq -r .runtimes.compact.wasm`
  echo "wasm=$WASM" >> $GITHUB_OUTPUT

  Z_WASM=`echo $JSON | jq -r .runtimes.compressed.wasm`
  echo "wasm_compressed=$Z_WASM" >> $GITHUB_OUTPUT

  IPFS=`echo $JSON | jq -r .runtimes.compact.ipfs`
  echo "ipfs=$IPFS" >> $GITHUB_OUTPUT
}
