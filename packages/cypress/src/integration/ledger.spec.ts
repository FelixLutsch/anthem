import { UTILS, getScreenType } from "../support/cypress-utils";

/** ===========================================================================
 * Test Ledger transactions
 * ============================================================================
 */

describe("Test Ledger Transactions", () => {
  beforeEach(() => {
    UTILS.loginWithAddress(getScreenType(), true);
  });

  afterEach(() => {
    UTILS.logout(getScreenType());
  });

  // Error with no value:
  it("The delegation transaction workflow can be completed", () => {
    UTILS.findAndClick("stake-button");
    UTILS.findAndClick(
      "validator-cosmosvaloper15urq2dtp9qce4fyc85m6upwm9xul3049e02707",
    );
    UTILS.findAndClick("delegate-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.shouldMatchText(
      "amount-transaction-error",
      "Please input an amount.",
    );

    // Open the validator menu and selector a validator
    UTILS.findAndClick("validator-composition-select-menu");
    UTILS.findAndClick("Cosmostation-delegation-option");

    // Error with very large value added:
    UTILS.typeText("transaction-amount-input", "500000000000");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.shouldMatchText(
      "amount-transaction-error",
      "Final value is greater than the maximum available.",
    );

    UTILS.findAndClick("transaction-delegate-all-toggle");
    UTILS.findAndClick("toggle-custom-gas-settings");

    UTILS.typeText("custom-gas-price-input", "0.05");
    UTILS.typeText("custom-gas-amount-input", "200000");

    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-submit-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-dialog-close-button");
  });

  it("The rewards claim transaction workflow can be completed", () => {
    UTILS.findAndClick("stake-button");
    UTILS.findAndClick(
      "validator-cosmosvaloper15urq2dtp9qce4fyc85m6upwm9xul3049e02707",
    );
    UTILS.findAndClick("claim-rewards-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");

    // Error with no validators selected:
    UTILS.shouldMatchText(
      "claims-transaction-error",
      "Please select at least one validator to withdraw rewards from.",
    );

    // Check both:
    UTILS.findAndClick("validator-check-option-0");
    UTILS.findAndClick("validator-check-option-1");

    // Uncheck both:
    UTILS.findAndClick("validator-check-option-0");
    UTILS.findAndClick("validator-check-option-1");

    UTILS.findAndClick("ledger-dialog-confirmation-button");

    // Error should persist after checking and unchecking both options;
    UTILS.shouldMatchText(
      "claims-transaction-error",
      "Please select at least one validator to withdraw rewards from.",
    );

    // Check both and proceed
    UTILS.findAndClick("validator-check-option-0");
    UTILS.findAndClick("validator-check-option-1");

    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-submit-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-dialog-close-button");
  });

  it("The send transaction workflow can be completed", () => {
    UTILS.findAndClick("send-receive-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");

    // Error with no validators selected:
    UTILS.shouldMatchText(
      "amount-send-transaction-error",
      "Please input an amount.",
    );

    // Error with very large value added:
    UTILS.typeText("transaction-send-amount-input", "500000000000");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.shouldMatchText(
      "amount-send-transaction-error",
      "Final value is greater than the maximum available.",
    );

    // Enter an amount
    UTILS.typeText("transaction-send-amount-input", "1");
    UTILS.typeText(
      "transaction-send-recipient-input",
      "cosmos15v50ymp6n5dn73erkqtmq0u8adpl8d3ujv2e74",
    );

    // Set gas settings
    UTILS.findAndClick("toggle-custom-gas-settings");
    UTILS.typeText("custom-gas-price-input", "0.05");
    UTILS.typeText("custom-gas-amount-input", "200000");

    UTILS.findAndClick("ledger-dialog-confirmation-button");
    UTILS.findAndClick("ledger-dialog-confirmation-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-submit-button");
    cy.wait(5000);
    UTILS.findAndClick("transaction-dialog-close-button");
  });
});
