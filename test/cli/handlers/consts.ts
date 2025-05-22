export const DOCKER_NETWORK_NAME = "datahaven-net";
export const COMPONENTS = {
  datahaven: {
    imageName: "moonsonglabs/datahaven",
    componentName: "Datahaven Network",
    optionName: "datahaven"
  },
  snowbridge: {
    imageName: "snowbridge-relayer",
    componentName: "Snowbridge Relayers",
    optionName: "relayer"
  }
} as const;
