// Primitives for browsing: open pages the way a person does (clicking links,
// opening windows, switching tabs) and observe which tabs and windows remain.

import assert from 'node:assert/strict';

import { Given, Then, When } from '@cucumber/cucumber';

function pathOf(world, page) {
  return world.site.pathOf(page.url());
}

function remember(world, page) {
  const path = pathOf(world, page);
  world.opened.set(path, [...(world.opened.get(path) ?? []), page]);
  return page;
}

function findPage(world, path) {
  const matches = world.browser.openPages().filter((page) => pathOf(world, page) === path);
  assert.ok(matches.length > 0, `no open tab shows ${path}`);
  return matches.at(-1);
}

async function openPaths(world) {
  await world.browser.settle();
  return world.browser
    .openPages()
    .map((page) => pathOf(world, page))
    .sort();
}

async function openFromLink(world, target, from) {
  const page = await world.browser.clickLinkToNewTab(findPage(world, from), target);
  remember(world, page);
  await world.browser.settle();
}

Given('the browser is running with Tab Trim installed', async function () {
  await this.browser.reset();
  this.started = true;
});

Given('I am looking at {string}', async function (path) {
  const [page] = this.browser.openPages();
  await page.goto(this.site.url(path));
  remember(this, page);
  await this.browser.settle();
});

When('I open {string} from the link on {string}', async function (target, from) {
  await openFromLink(this, target, from);
});

When('I open {string} from the link on {string} {int} times', async function (target, from, times) {
  for (let i = 0; i < times; i += 1) {
    await openFromLink(this, target, from);
  }
});

When('I open {int} different pages from links on {string}', async function (count, from) {
  for (let i = 1; i <= count; i += 1) {
    await openFromLink(this, `/page/${i}`, from);
  }
});

When('I open {string} in a new window', async function (path) {
  remember(this, await this.browser.openWindowAt(this.site.url(path)));
  await this.browser.settle();
});

When('I switch to the {string} tab', async function (path) {
  await findPage(this, path).bringToFront();
  await this.browser.settle();
});

When('I navigate the {string} tab to {string}', async function (path, target) {
  const page = findPage(this, path);
  await page.bringToFront();
  await page.goto(this.site.url(target));
  remember(this, page);
  await this.browser.settle();
});

Then('the open pages are {string}', async function (list) {
  const expected = list.split(',').map((item) => item.trim()).sort();
  assert.deepEqual(await openPaths(this), expected);
});

Then(/^there (?:is|are) (\d+) tabs? open$/, async function (count) {
  assert.equal((await openPaths(this)).length, Number(count));
});

Then(/^there (?:is|are) (\d+) windows? open$/, async function (count) {
  await this.browser.settle();
  assert.equal(await this.browser.windowCount(), Number(count));
});

Then(/^there (?:is|are) (\d+) cop(?:y|ies) of "([^"]+)" open$/, async function (count, path) {
  const copies = (await openPaths(this)).filter((open) => open === path);
  assert.equal(copies.length, Number(count));
});

Then('the oldest copy of {string} is gone', async function (path) {
  const [oldest] = this.opened.get(path) ?? [];
  assert.ok(oldest, `never opened ${path}`);
  assert.ok(oldest.isClosed(), `the first ${path} tab is still open`);
});

Then('{string} is not open', async function (path) {
  assert.ok(!(await openPaths(this)).includes(path), `${path} is still open`);
});
