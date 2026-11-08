const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'movies.json'), 'utf8'));
const movies = data.movies;
const byId = Object.fromEntries(movies.map(m => [m.id, m]));

const cardId = page => page.locator('.card').getAttribute('data-id');
const deal = page => page.getByRole('button', { name: 'Deal Me Another' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.card')).toBeVisible();
});

test('first pick renders with the key card parts', async ({ page }) => {
  await expect(page.locator('.title')).not.toBeEmpty();
  await expect(page.locator('.poster-wrap')).toBeVisible();
  await expect(page.locator('.tags li')).toHaveCount(3);
  await expect(page.locator('.marquee')).toBeVisible();
  await expect(page.getByText('Why it’s a good bad movie')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deal Me Another' })).toBeVisible();
});

test('30 deals produce no repeats', async ({ page }) => {
  const ids = [await cardId(page)];
  for (let i = 0; i < 29; i++) { await deal(page); ids.push(await cardId(page)); }
  expect(new Set(ids).size).toBe(30);
});

test('mood filter re-deals from the right pool and exhausts with Rewind message', async ({ page }) => {
  await page.getByRole('radio', { name: 'Rubber Monsters' }).click();
  const expected = movies.filter(m => m.moods.includes('creature'));
  const ids = [await cardId(page)];
  expect(byId[ids[0]].moods).toContain('creature');
  for (let i = 1; i < expected.length; i++) {
    await deal(page);
    const id = await cardId(page);
    expect(byId[id].moods).toContain('creature');
    ids.push(id);
  }
  expect(new Set(ids).size).toBe(expected.length);
  await deal(page);
  await expect(page.getByText('Rewind the tape?')).toBeVisible();
  await page.getByRole('button', { name: /Rewind/ }).click();
  await expect(page.locator('.card')).toBeVisible();
});

test('tier toggle re-deals from the right pool', async ({ page }) => {
  await page.getByRole('radio', { name: 'Classics' }).click();
  for (let i = 0; i < 10; i++) {
    expect(byId[await cardId(page)].tier).toBe('classic');
    await deal(page);
  }
  await page.getByRole('radio', { name: 'Deep Cuts' }).click();
  for (let i = 0; i < 10; i++) {
    expect(byId[await cardId(page)].tier).toBe('deep-cut');
    await deal(page);
  }
});

test('Back returns the previous pick', async ({ page }) => {
  const a = await cardId(page);
  await deal(page);
  const b = await cardId(page);
  await deal(page);
  expect(await cardId(page)).not.toBe(b);
  await page.getByRole('button', { name: /Back/ }).click();
  expect(await cardId(page)).toBe(b);
  await page.getByRole('button', { name: /Back/ }).click();
  expect(await cardId(page)).toBe(a);
});

test('Seen It persists across reload and Reset seen restores it', async ({ page }) => {
  const x = await cardId(page);
  await page.getByRole('button', { name: 'Seen It' }).click();
  expect(await cardId(page)).not.toBe(x);
  await page.reload();
  await expect(page.locator('.card')).toBeVisible();
  const ids = new Set([await cardId(page)]);
  for (let i = 0; i < 120 && ids.size < 99; i++) {
    await deal(page);
    if (await page.getByText('Rewind the tape?').count()) break;
    ids.add(await cardId(page));
  }
  expect(ids.has(x)).toBe(false);
  expect(ids.size).toBe(99);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Reset seen' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('midnightVideo.seen') || '[]').length)).toBe(0);
});

test('missing rating / runtime / imdbId fall back gracefully', async ({ page }) => {
  await page.route('**/movies.json', async route => {
    const d = JSON.parse(JSON.stringify(data));
    d.movies = [{ ...d.movies[0], poster: null, runtime: null, imdbRating: null, ratingAsOf: null, imdbId: null }];
    await route.fulfill({ json: d });
  });
  await page.reload();
  await expect(page.getByText('Rating unavailable')).toBeVisible();
  await expect(page.locator('.spine')).toBeVisible();
  await expect(page.locator('a.imdb')).toHaveCount(0);
});

test('shown IMDb link is well-formed and opens in a new tab', async ({ page }) => {
  const link = page.locator('a.imdb');
  if (await link.count()) {
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.imdb\.com\/title\/tt\d{7,9}\/$/);
    await expect(link).toHaveAttribute('target', '_blank');
  }
});

// Data checks (same at both widths, so run once)
test.describe('data', () => {
  test.beforeEach(() => { test.skip(test.info().project.name !== 'phone-390', 'run once'); });

  test('every IMDb id is well-formed', () => {
    const bad = movies.filter(m => m.imdbId && !/^tt\d{7,9}$/.test(m.imdbId)).map(m => `${m.title}: ${m.imdbId}`);
    expect(bad).toEqual([]);
    const missing = movies.filter(m => !m.imdbId).map(m => m.title);
    if (missing.length) console.log('No imdbId (link hidden):', missing.join('; '));
  });

  test('every poster URL returns 200', async ({ request }) => {
    const withPoster = movies.filter(m => m.poster);
    const noPoster = movies.filter(m => !m.poster).map(m => m.title);
    if (noPoster.length) console.log('No poster URL (VHS fallback used):', noPoster.join('; '));
    const failures = [];
    for (let i = 0; i < withPoster.length; i += 10) {
      await Promise.all(withPoster.slice(i, i + 10).map(async m => {
        try {
          const r = await request.get(new URL(m.poster, 'http://localhost:4173/').href, { timeout: 20000 });
          if (r.status() !== 200) failures.push(`${m.title}: HTTP ${r.status()}`);
        } catch (e) { failures.push(`${m.title}: ${e.message.split('\n')[0]}`); }
      }));
    }
    if (failures.length) console.log('Poster failures:\n' + failures.join('\n'));
    expect(failures).toEqual([]);
  });
});
