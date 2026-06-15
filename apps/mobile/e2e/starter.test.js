describe('App launch', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows the login screen', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
  });
});

describe('Auth flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('accepts a phone number', async () => {
    await element(by.id('phone-input')).typeText('+15555550100');
    await element(by.id('continue-button')).tap();
    await expect(element(by.id('otp-screen'))).toBeVisible();
  });
});

describe('Home screen', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      // Pass a pre-issued staging token so we skip real OTP
      userNotification: { fireDate: new Date().toISOString() },
      launchArgs: { stagingAuthToken: process.env.STAGING_AUTH_TOKEN || '' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('renders the globe tab', async () => {
    await expect(element(by.id('tab-globe'))).toBeVisible();
  });

  it('renders the feed tab', async () => {
    await element(by.id('tab-feed')).tap();
    await expect(element(by.id('feed-screen'))).toBeVisible();
  });
});
