import { salesforceConnector } from "./salesforce.js";
import { salesfinityConnector } from "./salesfinity.js";
import { fathomConnector } from "./fathom.js";
import { amplemarketConnector } from "./amplemarket.js";
import { openfunnelConnector } from "./openfunnel.js";
import type { Connector } from "../types.js";

export const allConnectors: Connector[] = [
  salesforceConnector,
  salesfinityConnector,
  fathomConnector,
  amplemarketConnector,
  openfunnelConnector,
];

export {
  salesforceConnector,
  salesfinityConnector,
  fathomConnector,
  amplemarketConnector,
  openfunnelConnector,
};
