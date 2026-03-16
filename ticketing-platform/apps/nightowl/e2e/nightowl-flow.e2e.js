const { launchNightowl, openTab, scrollToElement, signInAsDemoUser } = require('./support/nightowlActions');

describe('Nightowl app', () => {
  beforeEach(async () => {
    await launchNightowl();
  });

  it('lets an attendee buy a ticket and see it in the wallet', async () => {
    await signInAsDemoUser('attendee@nightowl.local');

    await expect(element(by.id('demo-mode-badge'))).toBeVisible();
    await waitFor(element(by.id('discover-selected-event-title')))
      .toHaveText('Warehouse Pulse')
      .withTimeout(20000);

    await scrollToElement('discover-ticket-general-admission-add-button');
    await element(by.id('discover-ticket-general-admission-add-button')).tap();

    await openTab('tab-cart');
    await waitFor(element(by.id('cart-total-value'))).toHaveText('US$32.00').withTimeout(10000);

    await element(by.id('checkout-method-card')).tap();
    await element(by.id('checkout-pay-button')).tap();

    await waitFor(element(by.text('Order is already paid. Ticket wallet refreshed.')))
      .toBeVisible()
      .withTimeout(20000);

    await openTab('tab-tickets');
    await waitFor(element(by.id('ticket-event-title-0'))).toBeVisible().withTimeout(10000);
    await expect(element(by.id('ticket-event-title-0'))).toHaveText('Warehouse Pulse');
    await expect(element(by.id('ticket-status-0'))).toHaveText('VALID');
    await scrollToElement('ticket-payload-0');
    await waitFor(element(by.id('ticket-payload-0'))).toBeVisible().withTimeout(10000);
  });

  it('shows scanner tooling for staff accounts', async () => {
    await signInAsDemoUser('staff@nightowl.local');

    await openTab('tab-scanner');
    await scrollToElement('scanner-input');
    await waitFor(element(by.id('scanner-input'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('scanner-validate-button'))).toBeVisible().withTimeout(10000);
  });
});
