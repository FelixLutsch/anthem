import { Variables } from "graphql-request/dist/src/types";

/** ===========================================================================
 * Configuration for automatically runnings GraphQL queries against the
 * server.
 *
 * If a new query is added to the server, it may need new configuration added
 * if it accepts variables. This should be added in the `VARIABLES_CONFIG`
 * below.
 * ============================================================================
 */

export interface VarConfig {
  variables: Variables;
  test: (s: string) => boolean;
}

/**
 * Variable config source of truth for which variables will be mapped
 * to which queries.
 */
const VARIABLES_CONFIG: ReadonlyArray<VarConfig> = [
  {
    variables: {
      fiat: "USD",
      network: "COSMOS",
      validatorAddress: "cosmosvaloper15urq2dtp9qce4fyc85m6upwm9xul3049e02707",
    },
    test: (s: string) => {
      return s.includes("$fiat") && s.includes("$validatorAddress");
    },
  },
  {
    variables: {
      fiat: "USD",
      currency: "ATOM",
    },
    test: (s: string) => {
      return s.includes("$currency") && s.includes("$fiat");
    },
  },
  {
    variables: {
      fiat: "USD",
      network: "COSMOS",
      address: "cosmos15urq2dtp9qce4fyc85m6upwm9xul3049um7trd",
    },
    test: (s: string) => {
      return s.includes("$fiat") && s.includes("$address");
    },
  },
  {
    variables: {
      fiat: "USD",
      network: "COSMOS",
    },
    test: (s: string) => {
      return s.includes("$fiat");
    },
  },
  {
    variables: {
      network: "COSMOS",
      address: "cosmos15urq2dtp9qce4fyc85m6upwm9xul3049um7trd",
    },
    test: (s: string) => s.includes("$address"),
  },
  {
    variables: {
      network: "COSMOS",
      txHash:
        "E0BC81E3B76F70466D8F235F02EDD3F3E23E8C52A40D27A650BC14A9E6F8239C",
    },
    test: (s: string) => s.includes("$txHash"),
  },
  {
    variables: {
      network: "COSMOS",
      validatorAddress: "cosmosvaloper15urq2dtp9qce4fyc85m6upwm9xul3049e02707",
    },
    test: (s: string) => s.includes("$validatorAddress"),
  },
  {
    variables: {
      versus: "USD",
      currency: "ATOM",
    },
    test: (s: string) => s.includes("$currency") && s.includes("$versus"),
  },
  {
    variables: {
      network: "COSMOS",
    },
    test: (s: string) => s.includes("$network"),
  },
];

/** ===========================================================================
 * Export
 * ============================================================================
 */

export { VARIABLES_CONFIG };
