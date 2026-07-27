/**
 * Detaches the israeli-bank-scrapers dependency from package.json and package-lock.json
 * so the image build can install it from a tarball instead.
 *
 * Locally the scraper is consumed as `file:../../israeli-bank-scrapers`, a path that does
 * not exist inside the image. Leaving that entry in place makes `npm install` abort with
 * "Cannot read properties of undefined (reading 'extraneous')" because the lockfile
 * describes a link whose target is missing. Removing just this one package keeps the rest
 * of the lockfile authoritative, so every other dependency is still installed at a pinned
 * version.
 */
const fs = require('fs');

const PACKAGE = 'israeli-bank-scrapers';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.dependencies) {
  delete pkg.dependencies[PACKAGE];
}
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

if (fs.existsSync('package-lock.json')) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

  for (const key of Object.keys(lock.packages || {})) {
    // Matches both the "node_modules/israeli-bank-scrapers" link entry and the
    // "../../israeli-bank-scrapers" entry holding the linked package's own tree.
    if (key === PACKAGE || key.endsWith(`/${PACKAGE}`) || key.endsWith(`${PACKAGE}`)) {
      delete lock.packages[key];
    }
  }

  if (lock.packages && lock.packages[''] && lock.packages[''].dependencies) {
    delete lock.packages[''].dependencies[PACKAGE];
  }

  for (const key of Object.keys(lock.dependencies || {})) {
    if (key === PACKAGE) {
      delete lock.dependencies[key];
    }
  }

  fs.writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
}

console.log(`Detached ${PACKAGE} from package.json and package-lock.json`);
