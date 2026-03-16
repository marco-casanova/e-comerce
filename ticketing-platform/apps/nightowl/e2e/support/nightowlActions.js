const DEMO_PASSWORD = 'nightowl123';

async function launchNightowl() {
  await device.launchApp({
    delete: true,
    newInstance: true,
    permissions: {
      camera: 'NO',
    },
    url: 'nightowl://e2e',
  });
  await device.disableSynchronization();
}

async function waitForVisible(testID, timeout) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function signInAsDemoUser(email) {
  const loginAlreadyVisible = await waitForVisible('login-screen', 5000);

  if (!loginAlreadyVisible) {
    const appAlreadySignedIn = await waitForVisible('events-hero', 10000);

    if (appAlreadySignedIn) {
      await element(by.id('sign-out-button')).tap();
    }
  }

  await waitFor(element(by.id('login-screen'))).toBeVisible().withTimeout(15000);
  await element(by.id('login-email-input')).tap();
  await element(by.id('login-email-input')).clearText();
  await element(by.id('login-email-input')).typeText(email);
  await element(by.id('login-password-input')).tap();
  await element(by.id('login-password-input')).clearText();
  await element(by.id('login-password-input')).typeText(DEMO_PASSWORD);
  await element(by.id('login-submit-button')).tap();
  await waitFor(element(by.id('events-hero'))).toBeVisible().withTimeout(20000);
}

async function openTab(tabId) {
  await waitFor(element(by.id(tabId)))
    .toBeVisible()
    .whileElement(by.id('events-scroll'))
    .scroll(240, 'up');
  await element(by.id(tabId)).tap();
}

async function scrollToElement(testID, scrollViewID = 'events-scroll') {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .whileElement(by.id(scrollViewID))
    .scroll(240, 'down');
}

module.exports = {
  launchNightowl,
  openTab,
  scrollToElement,
  signInAsDemoUser,
};
