/**
 * Account identity fallback for DeepSeek Harness.
 *
 * The DeepSeek Platform profile read (`platform.deepseek.com/auth-api/v0/users/current`)
 * can be rejected by the Platform's edge protection (AWS WAF challenge / CloudFront 403)
 * even while the stored account credential is still valid. In that state the account UI
 * shows the generic avatar and the "Signed in to DeepSeek" label, because the profile
 * payload (name, contact, picture) never arrives.
 *
 * This Host plugin wraps the `deepseekAccount` service so that:
 *   - a successful profile read refreshes a small on-disk profile cache;
 *   - a failed (or throwing) profile read is answered from that cache, or from the
 *     plugin configuration when no cache exists yet.
 *
 * The identity is editable in the Harness UI (Plugins → this bundle → its row →
 * Configure): `name`, `contact` and `avatarUrl` are volatile config fields, so a
 * save reaches the running plugin in place and the account surfaces refresh.
 *
 * The account UI and Settings then render the last known identity instead of the
 * fallback label. Balance, sign-out, sign-in and model usage are untouched.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import Schema from '@deepseek-ai/schemastery'

export const name = 'account-identity-fallback'
export const inject = ['deepseekAccount']

/**
 * Identity fields exposed by the Plugins configuration page. These are volatile
 * fields: the settings service projects them into a form, and a volatile-only
 * edit is committed into the running plugin without restarting it.
 */
export const Config = Schema.object({
  name: Schema.string()
    .default('')
    .volatile()
    .description('Account name shown in the account menu and Settings. Empty falls back to the last known profile.'),
  contact: Schema.string()
    .default('')
    .description('Advanced (YAML only): contact line shown in Settings → Account under the name.'),
  avatarUrl: Schema.string()
    .default('')
    .volatile()
    .description('Avatar image URL (https:) or data: URL. Empty falls back to the last known profile.'),
  id: Schema.string()
    .default('')
    .description('Advanced (YAML only): account id used to prefill the Feedback form.'),
})

const LOG_PREFIX = '[account-identity-fallback]'
const CACHE_VERSION = 1
/** Account-service instance marker holding the original profile reader. */
const ORIGINAL_GET_PROFILE = Symbol.for('@tyapinalexandr/dsh-account-identity-fallback/original-get-profile')

/**
 * Resolve the Harness data root the same way the harness does: an explicit
 * `$DSH_HOME` wins, and `~/.dsh` is the default. The cache must live outside
 * the installed package so reinstalling or upgrading the plugin keeps it.
 * @returns absolute DSH home directory.
 */
function resolveDshHome() {
  const configured = process.env.DSH_HOME
  if (typeof configured === 'string' && configured.trim() !== '') return resolve(configured.trim())
  return join(homedir(), '.dsh')
}

/** Last-known profile cache under the DSH data root. */
const CACHE_FILE = join(resolveDshHome(), 'cache', 'account-identity-fallback', 'profile-cache.json')

/** Return a non-empty string, or null. */
function textOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Project an untrusted profile payload onto the account UI's profile shape.
 * @param value - value received from the account service.
 * @returns sanitized profile, or undefined when nothing usable remains.
 */
function projectProfile(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return {
    id: textOrNull(value.id),
    name: textOrNull(value.name),
    contact: textOrNull(value.contact),
    avatarUrl: textOrNull(value.avatarUrl),
  }
}

/** Whether a profile carries anything the account UI can display. */
function hasIdentity(profile) {
  return profile !== undefined
    && (profile.name !== null || profile.contact !== null || profile.avatarUrl !== null)
}

/**
 * Read one volatile configuration reference. Volatile fields arrive as
 * `Volatile` references whose `get()` returns the value committed by the
 * loader; reading at call time therefore sees a save made in the UI.
 * @param value - volatile reference or plain value.
 * @returns current value.
 */
function readVolatile(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * Build the identity named by the live plugin configuration.
 * @param config - live row configuration.
 * @returns configured profile, or undefined when the row names no identity.
 */
function configuredProfile(config) {
  const value = config ?? {}
  const profile = projectProfile({
    id: readVolatile(value.id),
    name: readVolatile(value.name),
    contact: readVolatile(value.contact),
    avatarUrl: readVolatile(value.avatarUrl),
  })
  return hasIdentity(profile) ? profile : undefined
}

/**
 * Merge the configured identity over the last known profile, field by field.
 * Explicit settings win; an empty field keeps the cached value.
 * @param configured - identity named by the configuration, if any.
 * @param cached - last profile read from the Platform, if any.
 * @returns the identity to serve, or undefined when neither source has one.
 */
function mergeProfile(configured, cached) {
  if (configured === undefined) return cached
  if (cached === undefined) return configured
  const merged = {
    id: configured.id ?? cached.id,
    name: configured.name ?? cached.name,
    contact: configured.contact ?? cached.contact,
    avatarUrl: configured.avatarUrl ?? cached.avatarUrl,
  }
  return hasIdentity(merged) ? merged : undefined
}

/** Read the persisted last-known profile; an absent or corrupt cache is not an error. */
async function readCachedProfile() {
  try {
    const parsed = JSON.parse(await readFile(CACHE_FILE, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== CACHE_VERSION) return undefined
    return projectProfile(parsed.profile)
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error(`${LOG_PREFIX} profile cache read failed`, { code: error?.code })
    return undefined
  }
}

/** Persist the last successful profile for the next blocked read. */
async function writeCachedProfile(profile) {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true })
    const temp = `${CACHE_FILE}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify({
      version: CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      profile,
    }), { encoding: 'utf8', mode: 0o600 })
    await rename(temp, CACHE_FILE)
  } catch (error) {
    console.error(`${LOG_PREFIX} profile cache write failed`, { code: error?.code })
  }
}

/**
 * Install the profile-read adapter.
 * @param ctx - Host context owning the account service.
 * @param config - volatile identity configuration; `name`, `contact`, `avatarUrl`, `id`.
 */
export function apply(ctx, config) {
  let cached
  const cacheReady = readCachedProfile().then((value) => { cached = value })
  const configuredSignature = () => {
    const profile = configuredProfile(config)
    if (profile === undefined) return ''
    return [profile.name, profile.contact, profile.avatarUrl, profile.id].map((value) => value ?? '').join('\u0000')
  }
  const fallback = () => mergeProfile(configuredProfile(config), cached)
  const nudge = () => {
    try {
      if (typeof account.changed === 'function') account.changed()
    } catch (error) {
      console.error(`${LOG_PREFIX} account change notification failed`, { code: error?.code })
    }
  }

  const account = ctx.deepseekAccount
  if (typeof account?.getProfile !== 'function') {
    console.error(`${LOG_PREFIX} deepseekAccount.getProfile is unavailable; fallback was not installed`)
    return
  }

  // Keep one true original reader on the service instance. A configuration
  // change can remount the plugin before the previous instance is disposed;
  // re-using the marker prevents stacking a patched reader on a patched
  // reader, which would make a fallback reply look like a real Platform read.
  const original = account[ORIGINAL_GET_PROFILE] ?? account.getProfile
  if (account[ORIGINAL_GET_PROFILE] === undefined) {
    try {
      Object.defineProperty(account, ORIGINAL_GET_PROFILE, { value: original, configurable: true })
    } catch (_error) {}
  }
  async function getProfile(client) {
    let result
    try {
      result = await original.call(account, client)
    } catch (error) {
      console.error(`${LOG_PREFIX} profile read threw`, { code: error?.code })
      result = undefined
    }

    if (result !== null && typeof result === 'object' && result.status === 'ready') {
      const profile = projectProfile(result.value)
      if (profile !== undefined) {
        cached = profile
        void writeCachedProfile(profile)
      }
      return result
    }

    // Only a signed-in-but-unreadable profile is replaced; null keeps sign-out.
    const blocked = result === undefined
      || (result !== null && typeof result === 'object' && result.status === 'failed')
    if (blocked) {
      await cacheReady
      const profile = fallback()
      if (profile !== undefined) return { status: 'ready', value: profile }
    }
    return result
  }

  account.getProfile = getProfile
  ctx.effect(() => () => {
    if (account.getProfile === getProfile) account.getProfile = original
  }, 'account-identity-fallback: restore profile read')

  // A configuration save from the Plugins page commits volatile fields in
  // place and emits `loader/volatile-update`; ask connected account surfaces to
  // read the profile again so the edited identity appears immediately.
  ctx.on('loader/volatile-update', nudge)

  // The loader event is the primary signal; the signature watch also covers a
  // remount race where the save lands between plugin instances.
  let lastSignature = configuredSignature()
  const watch = setInterval(() => {
    const next = configuredSignature()
    if (next === lastSignature) return
    lastSignature = next
    nudge()
  }, 1000)
  watch.unref?.()
  ctx.effect(() => () => clearInterval(watch), 'account-identity-fallback: configuration watch')

  // Nudge connected clients once at load so the restored identity is read now
  // instead of waiting for the next Settings visit or app restart.
  setTimeout(nudge, 0)
}
