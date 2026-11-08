// Fills imdbId, poster, runtime, imdbRating, ratingAsOf in movies.json using OMDb.
// Run locally: node scripts/resolve.js   (needs OMDB_API_KEY in .env)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const KEY = process.env.OMDB_API_KEY;
if (!KEY) { console.error('Missing OMDB_API_KEY in .env'); process.exit(1); }

const file = path.join(root, 'movies.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = new Date();
const asOf = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

async function omdb(params) {
  const url = 'https://www.omdbapi.com/?' + new URLSearchParams({ apikey: KEY, ...(params.i ? {} : { type: 'movie' }), ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 401) throw new Error('OMDb rejected the API key (401)');
      return await res.json();
    } catch (e) {
      if (/401/.test(e.message)) throw e;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { Response: 'False', Error: 'Network error' };
}

(async () => {
  const misses = [];
  for (const movie of data.movies) {
    const lookup = movie.omdbTitle || movie.title;
    // If Ken supplied an exact IMDb id (omdbId), look up by id instead of title+year.
    const r = movie.omdbId
      ? await omdb({ i: movie.omdbId })
      : await omdb({ t: lookup, y: String(movie.year) });
    if (r.Response !== 'True') {
      // Diagnose only (never accepted): is the title there under another year?
      const alt = await omdb({ t: lookup });
      const why = alt.Response === 'True'
        ? `wrong year? OMDb has "${alt.Title}" (${alt.Year}) ${alt.imdbID}`
        : 'not found';
      misses.push(`${movie.title} (${movie.year}): ${why}`);
      continue;
    }
    movie.imdbId = r.imdbID;
    // posterOverride (set by hand) wins when OMDb's poster link is dead or missing.
    movie.poster = movie.posterOverride || (r.Poster && r.Poster !== 'N/A' ? r.Poster : null);
    const mins = parseInt(r.Runtime, 10);
    movie.runtime = Number.isFinite(mins) ? mins : null;
    const rating = parseFloat(r.imdbRating);
    movie.imdbRating = Number.isFinite(rating) ? rating : null;
    movie.ratingAsOf = Number.isFinite(rating) ? asOf : null;
    if (!movie.poster) misses.push(`${movie.title} (${movie.year}): no poster (${r.imdbID})`);
    if (movie.runtime === null) misses.push(`${movie.title} (${movie.year}): no runtime (${r.imdbID})`);
    if (movie.imdbRating === null) misses.push(`${movie.title} (${movie.year}): no rating (${r.imdbID})`);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Resolved ${data.movies.length - misses.filter(m => /not found|wrong year/.test(m)).length} of ${data.movies.length}.`);
  if (misses.length) { console.log('\nNeeds attention:'); misses.forEach(m => console.log(' - ' + m)); }
  else console.log('No misses.');
})().catch(e => { console.error(e.message); process.exit(1); });
