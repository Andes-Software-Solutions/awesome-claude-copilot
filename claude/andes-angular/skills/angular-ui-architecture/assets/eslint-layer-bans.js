// @ts-check
// ESLint flat-config blocks that enforce the dependency direction of the angular-ui-architecture skill:
//   pages → components/<feature> → shared/components|directives|pipes → state → services → core → shared/utils → shared/models
// Usage (eslint.config.js, CommonJS):
//   const { layerBans } = require('./eslint-layer-bans');
//   module.exports = defineConfig([/* angular-eslint and NgRx blocks */, ...layerBans(__dirname)]);
// Options: { srcDir: 'src', banForms: false, skill: 'angular-ui-architecture' }
//   banForms: true once the app is on Signal Forms — bans FormsModule / ReactiveFormsModule imports.
const fs = require('node:fs');
const path = require('node:path');

const folder = (name) => [`@${name}/*`, `**/app/${name}/*`];

// Negate the directory itself: a gitignore matcher cannot re-include a child of an excluded directory.
const except = (name) => [`!@${name}`, `!**/app/${name}`];

const presentational = [
  ...folder('shared/components'),
  ...folder('shared/directives'),
  ...folder('shared/pipes'),
];

const allOfApp = [
  ...folder('pages'),
  ...folder('components'),
  ...folder('state'),
  ...folder('services'),
  ...folder('core'),
  ...folder('shared'),
];

/**
 * @param {string} rootDir the workspace root (usually `__dirname` of eslint.config.js)
 * @param {{ srcDir?: string, banForms?: boolean, skill?: string }} [options]
 */
function layerBans(rootDir, { srcDir = 'src', banForms = false, skill = 'angular-ui-architecture' } = {}) {
  const see = `see the ${skill} skill`;
  const src = srcDir.replace(/\/$/, '');
  const paths = banForms
    ? [{ name: '@angular/forms', importNames: ['FormsModule', 'ReactiveFormsModule'], message: `Use Signal Forms; ${see}.` }]
    : [];

  // Flat config replaces a rule's options when blocks overlap, so each layer block repeats the forms ban.
  const layer = (files, group) => ({
    files,
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths, patterns: [{ group, message: `Crosses a layer boundary; ${see}.` }] },
      ],
    },
  });

  const featuresOf = (kind) => {
    const dir = path.join(rootDir, src, 'app', kind);
    return fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : [];
  };

  return [
    ...(banForms ? [{ files: [`${src}/**/*.ts`], rules: { 'no-restricted-imports': ['error', { paths }] } }] : []),
    layer([`${src}/app/shared/models/**/*.ts`], ['@angular/*', '@ngrx/*', ...allOfApp, ...except('shared/models')]),
    layer(
      [`${src}/app/shared/utils/**/*.ts`],
      ['@angular/*', '@ngrx/*', ...allOfApp, ...except('shared/models'), ...except('shared/utils')],
    ),
    layer(
      [`${src}/app/core/**/*.ts`],
      [...presentational, ...folder('services'), ...folder('state'), ...folder('components'), ...folder('pages')],
    ),
    layer(
      [`${src}/app/services/**/*.ts`],
      [...presentational, ...folder('state'), ...folder('components'), ...folder('pages')],
    ),
    layer([`${src}/app/state/**/*.ts`], [...presentational, ...folder('components'), ...folder('pages')]),
    layer(
      [`${src}/app/shared/{components,directives,pipes}/**/*.ts`],
      ['@state/*/*', '**/app/state/*/*', ...folder('components'), ...folder('pages')],
    ),
    ...featuresOf('components').map((feature) =>
      layer(
        [`${src}/app/components/${feature}/**/*.ts`],
        [...folder('pages'), ...folder('components'), ...except(`components/${feature}`)],
      ),
    ),
    ...featuresOf('pages').map((feature) =>
      layer([`${src}/app/pages/${feature}/**/*.ts`], [...folder('pages'), ...except(`pages/${feature}`)]),
    ),
  ];
}

module.exports = { layerBans };
