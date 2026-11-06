# Maintaining this package

Maintainer notes. This file is not part of the npm tarball (it is not listed in
`files`), so it is not visible on the public package page.

## Publish a release

The package is a publishable bundle: not `private`, declares `dsh.bundle`,
`engines.dsh` and ships the bundle patch in `files`.

1. Bump `version` in `package.json` (every published change needs a new version).
2. Check the tarball contents:

   ```sh
   npm pack --dry-run
   ```

   It must contain `index.js`, `cordis.patch.yml`, `icon.svg`, `locale/*.json`,
   `README.md`, `LICENSE` and `package.json` — and no cache files.

3. Publish from the account that owns the `@tyapinalexandr` scope:

   ```sh
   npm login
   npm publish --access public
   # npm will ask for two-factor authentication (OTP from the authenticator app
   # or the browser flow). For scripting: --otp=123456
   ```

4. The registry replicates new versions with a short delay (the page and
   `npm view` can return 404 for a few minutes). Verify:

   ```sh
   npm view @tyapinalexandr/dsh-account-identity-fallback version
   ```

   The public page shows the README of the latest published version, so README
   fixes require a new version. The npm registry does not let you edit a
   published tarball in place.

5. Optional: remove an older version that should not be publicly visible
   (allowed within 72 hours of publishing it):

   ```sh
   npm unpublish @tyapinalexandr/dsh-account-identity-fallback@<version> --force
   ```

## Verify an install

From a checkout, in a scratch profile:

```sh
DSH_HOME=/tmp/dsh-profile dsh --profile verify --from-default-profile web
DSH_HOME=/tmp/dsh-profile dsh plugin --profile verify add @tyapinalexandr/dsh-account-identity-fallback
```

Then boot the profile and check that the `account-identity-fallback` row is
active in the composed configuration (`--dump-config`).

## Registry requirements checked by the plugin manager

Before installing, the Host inspects the registry package and requires:

- the package to declare a bundle (`dsh.bundle.patch` with a readable patch);
- `engines.dsh` (or DSH peer ranges) to accept the running Harness version;
- the package tarball to contain the plugin entry point and bundle patch.

Third-party plugins are upgraded by removing and installing them again.
