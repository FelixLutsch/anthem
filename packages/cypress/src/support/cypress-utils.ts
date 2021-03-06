/** ===========================================================================
 * Types & Constants
 * ============================================================================
 */

export const getScreenType = (mobile?: boolean) => ({
  isMobile: () => mobile,
  isDesktop: () => !mobile,
});

export const APP_URL = Cypress.env("HOST");

/**
 * Screen sizes to use in tests. Covers mobile, tablet, and desktop
 * screen sizes.
 */
export const SCREEN_SIZES = [
  {
    type: getScreenType(true),
    size: "iphone-6+",
  },
  {
    type: getScreenType(true),
    size: "ipad-2",
  },
  {
    type: getScreenType(false),
    size: [1024, 768],
  },
];

/** ===========================================================================
 * Cypress Utils
 * ============================================================================
 */

/**
 * Find an element using the Cypress `data-cy` attribute.
 */
const find = (id: string) => `[data-cy=${id}]`;

/**
 * Find an element by id and click it.
 */
const findAndClick = (id: string) => {
  cy.get(find(id)).click({ force: true });
};

/**
 * Type some text in the specified element.
 */
const typeText = (id: string, text: string) => {
  cy.get(`[data-cy=${id}]`)
    .clear()
    .type(text);
};

/**
 * Find an element by id and expect the contained text matches
 * the provided text exactly.
 */
const shouldMatchText = (id: string, text: string) => {
  cy.get(find(id)).should("have.text", text);
};

/**
 * Find an element by id and expect the element text includes the
 * provided text.
 */
const shouldContainText = (id: string, text: string) => {
  cy.get(find(id)).should(t => t.text().includes(text));
};

/**
 * Set the test browser viewport size using Cypress. This is used
 * to set the viewport size before a test begins to test various
 * viewport sizes.
 */
const setViewportSize = (size: any) => {
  if (Cypress._.isArray(size)) {
    cy.viewport(size[0], size[1]);
  } else {
    cy.viewport(size);
  }
};

/**
 * Helper to login using the address login.
 */
const loginWithAddress = (type: any, useLedger = false) => {
  /**
   * Visit the app. Expect redirect to login and initiate the login
   * enter address flow.
   */
  cy.visit(`${APP_URL}/total`);
  cy.url().should("contain", "/login");

  /**
   * Proxy for randomly choosing login by ledger or address - this mixes
   * the login method randomly and will end up testing both options while
   * the tests run.
   *
   * NOTE: Ledger signin is only allowed on desktop currently.
   */
  if (useLedger || (Date.now() % 2 === 0 && type.isDesktop())) {
    // Ledger signin:
    findAndClick("ledger-signin");
    findAndClick("COSMOS-network-login");
  } else {
    // Address signin:
    findAndClick("address-signin");
    // Set an address before each test.
    const address = "cosmos15urq2dtp9qce4fyc85m6upwm9xul3049um7trd";
    cy.get("[data-cy=address-input]").type(address);
    cy.get("[data-cy=address-input-form]").submit();
  }

  if (type.isDesktop()) {
    cy.get(find("user-selected-address-bar")).should(
      "have.text",
      "cosmos15...um7trd",
    );
  }

  cy.url().should("contain", "/total");
};

/**
 * Helper to logout.
 */
const logout = (type: any) => {
  if (type.isMobile()) {
    UTILS.findAndClick("hamburger-menu-button");
  }

  // Click the logout link in the SideMenu
  cy.get(find("logout-navigation-link")).click({ force: true });

  /**
   * NOTE: Use the cypress suggested selector for the Logout button, I'm not
   * sure how to pass a custom data-cy attribute to this button since it is
   * rendered by Blueprint by default in the Alert modal.
   */
  cy.get(".bp3-intent-danger > .bp3-button-text").click({ force: true });

  // Assert the logout action has occurred successfully
  cy.url().should("contain", "/login");
};

/** ===========================================================================
 * Export
 * ============================================================================
 */

export const UTILS = {
  find,
  typeText,
  findAndClick,
  shouldMatchText,
  shouldContainText,
  setViewportSize,
  loginWithAddress,
  logout,
};
