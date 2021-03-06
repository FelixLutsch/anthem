import {
  assertUnreachable,
  deriveNetworkFromAddress,
  getNetworkDefinitionFromIdentifier,
  validatorAddressToOperatorAddress,
} from "@anthem/utils";
import { LEDGER_ERRORS } from "constants/ledger-errors";
import Analytics from "lib/analytics-lib";
import StorageModule from "lib/storage-lib";
import { EpicSignature, ReduxActionTypes } from "modules/root";
import { i18nSelector } from "modules/settings/selectors";
import { combineEpics } from "redux-observable";
import { from } from "rxjs";
import {
  filter,
  ignoreElements,
  map,
  mergeMap,
  pluck,
  takeUntil,
  tap,
} from "rxjs/operators";
import { connectCeloAddress } from "tools/celo-ledger-utils";
import {
  capitalizeString,
  getQueryParamsFromUrl,
  onChartView,
  wait,
} from "tools/client-utils";
import { getAccAddress } from "tools/terra-library/key-utils";
import {
  validateLedgerAppVersion,
  validateNetworkAddress,
} from "tools/validation-utils";
import { isActionOf } from "typesafe-actions";
import Toast from "ui/Toast";
import { Actions } from "../root-actions";
import selectors, { addressSelector } from "./selectors";

/** ===========================================================================
 * Epics
 * ============================================================================
 */

const setAddressEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.setAddress)),
    map(({ payload, meta }) => {
      let setAddress = payload;
      const { tString } = i18nSelector(state$.value);
      const address = addressSelector(state$.value);

      if (payload.length > 52) {
        return Actions.searchTransactionByHash(payload);
      }

      // Convert validator address to operator addresses
      if (setAddress.includes("valoper")) {
        setAddress = validatorAddressToOperatorAddress(setAddress);
      }

      const maybeErrorMessage = validateNetworkAddress(
        setAddress,
        address,
        tString,
      );

      if (maybeErrorMessage) {
        if (meta.showToastForError) {
          Toast.warn(maybeErrorMessage);
        }

        return Actions.setAddressFailure(maybeErrorMessage);
      }

      StorageModule.setAddress(setAddress);
      StorageModule.updateRecentAddress(setAddress);
      Analytics.setAddress(setAddress);

      const network = deriveNetworkFromAddress(setAddress);

      return Actions.setAddressSuccess({
        network,
        address: setAddress,
      });
    }),
  );
};

/**
 * Epic to handle connecting a Ledger in response to various actions. Maps
 * to the connect action if the Ledger is not currently connected and
 * if the Ledger Dialog action has been dispatched.
 */
const ledgerDialogConnectionEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.openLedgerDialog)),
    pluck("payload"),
    pluck("signinType"),
    filter(x => x === "LEDGER"),
    filter(() => !state$.value.ledger.ledger.connected),
    map(() => Actions.connectLedger()),
  );
};

const connectLedgerEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.connectLedger)),
    mergeMap(() => {
      return from(
        new Promise<ReduxActionTypes>(async resolve => {
          try {
            const { ledger } = deps;
            const { signinNetworkName } = selectors.ledgerDialogSelector(
              state$.value,
            );

            const networkDefinition = getNetworkDefinitionFromIdentifier(
              signinNetworkName,
            );

            // Fail fast if the network does not have Ledger support yet.
            if (!networkDefinition.supportsLedger) {
              Toast.warn(
                `${networkDefinition.name} Network is not supported on Ledger yet.`,
              );
              return resolve(Actions.connectLedgerFailure());
            }

            let ledgerAddress;
            let ledgerAppVersion = "0.0.0";

            // TODO: Refactor this to a separate function, e.g. getAddressFromLedger
            switch (signinNetworkName) {
              case "COSMOS": {
                await ledger.connectDevice();
                ledgerAddress = await ledger.getCosmosAddress();
                ledgerAppVersion = await ledger.getCosmosAppVersion();
                break;
              }
              case "KAVA":
              case "TERRA": {
                await ledger.connectDevice();
                const pk = await ledger.getPubKey();
                if (typeof pk === "string") {
                  ledgerAddress = getAccAddress(
                    Buffer.from(pk),
                    signinNetworkName,
                  );
                } else {
                  ledgerAddress = getAccAddress(pk, signinNetworkName);
                }

                ledgerAppVersion = await ledger.getCosmosAppVersion();
                break;
              }
              case "CELO": {
                ledgerAddress = await connectCeloAddress();
                // TODO: How to get Celo App version?
                ledgerAppVersion = "1.0.1";
                break;
              }
              case "OASIS": {
                return resolve(Actions.connectLedgerFailure());
              }
              default: {
                return assertUnreachable(signinNetworkName);
              }
            }

            const network = deriveNetworkFromAddress(ledgerAddress);
            const versionValid = validateLedgerAppVersion(
              ledgerAppVersion,
              network.ledgerAppVersion,
            );

            if (!versionValid) {
              Toast.danger(
                `Invalid ${network.ledgerAppName} version! Please upgrade your ${network.ledgerAppName} Ledger application!`,
              );
              return resolve(Actions.connectLedgerFailure());
            }

            Toast.success(
              `Ledger connected to ${capitalizeString(
                signinNetworkName,
              )} Network!`,
            );

            return resolve(
              Actions.connectLedgerSuccess({
                network,
                ledgerAppVersion,
                ledgerAddress,
              }),
            );
          } catch (error) {
            console.log(error);
            let retryDelay = 500;
            const { message } = error;

            if (message === LEDGER_ERRORS.BROWSER_NOT_SUPPORTED) {
              Toast.warn("This browser is not supported.");
            } else if (
              message === LEDGER_ERRORS.COSMOS_LEDGER_SCREENSAVER_ERROR
            ) {
              const { tString } = i18nSelector(state$.value);
              Toast.warn(
                tString(
                  "The screensaver mode is currently active on the Ledger Device",
                ),
              );

              // Extend the retry delay to allow the screensaver to be dismissed
              retryDelay = 6500;
            }

            await wait(retryDelay);
            return resolve(Actions.connectLedger());
          }
        }),
        // Discard stream when the Ledger dialog is dismissed
      ).pipe(takeUntil(action$.ofType(Actions.closeLedgerDialog().type)));
    }),
  );
};

const logoutEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.confirmLogout)),
    tap(() => {
      // Remove local storage state
      StorageModule.logout();

      // Reset Apollo cache
      const { client } = deps;
      client.cache.reset();

      // Record analytics
      Analytics.logout();

      // Redirect to welcome route
      // NOTE: Welcome UI is not enabled yet
      // router.push("/welcome");

      // Render toast success message
      const { tString } = i18nSelector(state$.value);
      Toast.success(tString("Logout Success."));
    }),
    map(Actions.logoutSuccess),
  );
};

const saveAddressEpic: EpicSignature = action$ => {
  return action$.pipe(
    filter(
      isActionOf([Actions.connectLedgerSuccess, Actions.setAddressSuccess]),
    ),
    pluck("payload"),
    tap(payload => {
      let address = "";
      if ("ledgerAddress" in payload) {
        address = payload.ledgerAddress;
      } else {
        address = payload.address;
      }

      StorageModule.setAddress(address);
      StorageModule.updateRecentAddress(address);
    }),
    ignoreElements(),
  );
};

/**
 * When the address updates sync it to the url if it's out of sync.
 */
const syncAddressToUrlEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.setAddressSuccess)),
    pluck("payload"),
    pluck("address"),
    tap(address => {
      const { transactionsPage } = state$.value.transaction;
      const params = getQueryParamsFromUrl(deps.router.location.search);

      const search =
        transactionsPage > 1
          ? `?address=${address}&page=${transactionsPage}`
          : `?address=${address}`;

      if (params.address !== address) {
        deps.router.replace({ search });
      }
    }),
    ignoreElements(),
  );
};

/**
 * Set the address from routing events, if they routed address is
 * different from the stored address.
 */
const setAddressOnNavigationEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.onRouteChange)),
    pluck("payload"),
    pluck("search"),
    map(search => {
      const { address } = getQueryParamsFromUrl(search);
      const ledger = state$.value.ledger;

      // Make no update if the /login page is active
      if (deps.router.location.pathname.includes("login")) {
        return Actions.empty("No action taken to update location query params");
      }

      if (typeof address === "string" && address !== ledger.ledger.address) {
        return Actions.setAddress(address, { showToastForError: false });
      } else {
        return Actions.empty("No action taken to update location query params");
      }
    }),
  );
};

/**
 * Sync the address to the url after navigation events.
 */
const syncAddressToUrlOnNavigationEpic: EpicSignature = (
  action$,
  state$,
  deps,
) => {
  return action$.pipe(
    filter(isActionOf(Actions.onRouteChange)),
    pluck("payload"),
    tap(() => {
      const { address } = state$.value.ledger.ledger;
      const { transactionsPage } = state$.value.transaction;
      const { locationState } = state$.value.app.app;
      const params = getQueryParamsFromUrl(locationState.search);

      const search =
        transactionsPage > 1
          ? `?address=${address}&page=${transactionsPage}`
          : `?address=${address}`;

      // Update if an address exists, the chart view is active, and
      // if the path search values do not match
      if (!!address && onChartView(locationState.pathname) && !params.address) {
        deps.router.replace({ search });
      }
    }),
    ignoreElements(),
  );
};

/**
 * Sync the address to the url when the app initializes.
 */
const syncAddressToUrlOnInitializationEpic: EpicSignature = (
  action$,
  state$,
  deps,
) => {
  return action$.pipe(
    filter(isActionOf(Actions.initializeAppSuccess)),
    pluck("payload"),
    pluck("address"),
    tap(() => {
      const { location } = deps.router;
      const { address } = state$.value.ledger.ledger;
      const { transactionsPage } = state$.value.transaction;

      const search =
        transactionsPage > 1
          ? `?address=${address}&page=${transactionsPage}`
          : `?address=${address}`;

      // If the current location does not include the address, sync it
      if (
        onChartView(location.pathname) &&
        !location.search.includes(address)
      ) {
        deps.router.replace({ search });
      }
    }),
    ignoreElements(),
  );
};

const searchTransactionNavigationEpic: EpicSignature = (
  action$,
  state$,
  deps,
) => {
  return action$.pipe(
    filter(isActionOf(Actions.searchTransactionByHash)),
    pluck("payload"),
    tap(hash => deps.router.push({ pathname: `/txs/${hash.toLowerCase()}` })),
    ignoreElements(),
  );
};

const clearAllRecentAddressesEpic: EpicSignature = action$ => {
  return action$.pipe(
    filter(isActionOf(Actions.clearAllRecentAddresses)),
    tap(StorageModule.clearRecentAddresses),
    ignoreElements(),
  );
};

/** ===========================================================================
 * Export
 * ============================================================================
 */

export default combineEpics(
  setAddressEpic,
  ledgerDialogConnectionEpic,
  connectLedgerEpic,
  logoutEpic,
  saveAddressEpic,
  syncAddressToUrlEpic,
  syncAddressToUrlOnNavigationEpic,
  syncAddressToUrlOnInitializationEpic,
  setAddressOnNavigationEpic,
  searchTransactionNavigationEpic,
  clearAllRecentAddressesEpic,
);
