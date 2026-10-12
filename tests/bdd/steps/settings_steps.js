// Primitives for the Tab Trim settings page.

import assert from 'node:assert/strict';

import { Given, Then, When } from '@cucumber/cucumber';

const FIELDS = {
  'maximum tabs': 'Maximum open tabs',
  'maximum copies': 'Maximum copies of the same URL',
};

function settingsPage(world) {
  const page = world.browser.openPages().find((candidate) => candidate.url() === world.browser.optionsUrl());
  assert.ok(page, 'the settings page is not open');
  return page;
}

async function openSettings(world) {
  const [page] = world.browser.openPages();
  await page.goto(world.browser.optionsUrl());
  await page.locator('body[data-ready="true"]').waitFor();
  return page;
}

async function reopenSettings(world) {
  const page = settingsPage(world);
  await page.reload();
  await page.locator('body[data-ready="true"]').waitFor();
  return page;
}

function field(page, name) {
  const label = FIELDS[name];
  assert.ok(label, `unknown field ${name}`);
  return page.getByLabel(label);
}

async function assertVisible(world) {
  const page = settingsPage(world);
  await page.getByRole('heading', { name: 'Tab Trim' }).waitFor();
  await page.getByRole('button', { name: 'Save' }).waitFor();
}

async function saveField(world, name, value) {
  const page = await openSettings(world);
  await field(page, name).fill(value);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('status').getByText('Saved.').waitFor();
}

When('I open the Tab Trim settings page', async function () {
  await openSettings(this);
});

// As a Then it checks the page just opened; as the opening Given of a scenario
// it first reaches the page from a freshly reset browser.
Given('the settings page is visible', async function () {
  if (!this.started) {
    await this.browser.reset();
    this.started = true;
    await openSettings(this);
  }
  await assertVisible(this);
});

Given(/^the (maximum tabs|maximum copies) is set to (\d+) on the settings page$/, async function (name, value) {
  await saveField(this, name, String(value));
});

When(/^I set the (maximum tabs|maximum copies) to "([^"]*)"$/, async function (name, value) {
  await field(settingsPage(this), name).fill(value);
});

When('I press {string}', async function (button) {
  await settingsPage(this).getByRole('button', { name: button }).click();
});

When('I reopen the settings page', async function () {
  await reopenSettings(this);
});

Then('I see the status {string}', async function (message) {
  const status = settingsPage(this).getByRole('status');
  await status.getByText(message, { exact: true }).waitFor();
});

Then(/^the (maximum tabs|maximum copies) field shows "([^"]*)"$/, async function (name, value) {
  assert.equal(await field(settingsPage(this), name).inputValue(), value);
});

Then(
  /^after reopening the settings page the (maximum tabs|maximum copies) field shows "([^"]*)"$/,
  async function (name, value) {
    const page = await reopenSettings(this);
    assert.equal(await field(page, name).inputValue(), value);
  },
);

Then('the settings page says {string}', async function (text) {
  const summary = settingsPage(this).locator('#summary');
  await summary.getByText(text, { exact: true }).waitFor();
});
