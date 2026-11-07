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
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
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
    .description('Avatar URL (https:), a dsh-file: reference to a stored upload, or a legacy data: URL. Empty falls back to the last known profile.'),
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

/** Uploaded avatar files live in the plugin's own data directory, not in the profile. */
const AVATAR_DIR = join(resolveDshHome(), 'account-identity-fallback', 'avatars')
/** Configuration value that names an avatar file on disk. */
const AVATAR_REF_PREFIX = 'dsh-file:'
/** MIME type per accepted avatar extension. */
const AVATAR_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
const AVATAR_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
/** Stored avatar file name pattern; also rejects any path traversal. */
const AVATAR_NAME = /^avatar-[0-9a-f]{16,64}\.(?:png|jpg|webp|gif)$/
/** Stored avatar byte limit and the request body limit around it. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_UPLOAD_BODY = 3 * 1024 * 1024
/** Decoded avatar cache: file name -> { mtimeMs, dataUrl }. */
const avatarDataCache = new Map()

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

/** Whether the leading bytes match the declared image format. */
function matchesImageMagic(bytes, ext) {
  if (ext === 'png') {
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }
  if (ext === 'jpg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (ext === 'gif') {
    const header = bytes.subarray(0, 6).toString('ascii')
    return header === 'GIF87a' || header === 'GIF89a'
  }
  if (ext === 'webp') {
    return bytes.length > 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

/**
 * Decode one image data URL into its bytes and extension.
 * @param dataUrl - explicit `data:image/*;base64,...` URL.
 * @returns decoded image, or undefined when the value is not a supported image.
 */
function decodeAvatarData(dataUrl) {
  if (typeof dataUrl !== 'string') return undefined
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (match === null) return undefined
  const ext = AVATAR_EXT[match[1]]
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return undefined
  if (!matchesImageMagic(bytes, ext)) return undefined
  return { bytes, ext }
}

/**
 * Store one uploaded avatar under the plugin data directory.
 * @param bytes - decoded image bytes.
 * @param ext - file extension.
 * @returns the `dsh-file:` reference to save in the configuration.
 */
async function storeAvatar(bytes, ext) {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24)
  const file = `avatar-${hash}.${ext}`
  const target = join(AVATAR_DIR, file)
  await mkdir(AVATAR_DIR, { recursive: true })
  const temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, bytes)
  await rename(temp, target)
  avatarDataCache.delete(file)
  return `${AVATAR_REF_PREFIX}${file}`
}

/**
 * Read a stored avatar back as a data URL, cached by modification time.
 * @param file - stored avatar file name.
 * @returns data URL, or undefined when the file is missing or unreadable.
 */
async function readAvatarDataUrl(file) {
  if (!AVATAR_NAME.test(file)) return undefined
  const target = join(AVATAR_DIR, file)
  try {
    const info = await stat(target)
    const cached = avatarDataCache.get(file)
    if (cached !== undefined && cached.mtimeMs === info.mtimeMs) return cached.dataUrl
    const bytes = await readFile(target)
    const ext = file.slice(file.lastIndexOf('.') + 1)
    const dataUrl = `data:${AVATAR_MIME[ext] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`
    avatarDataCache.set(file, { mtimeMs: info.mtimeMs, dataUrl })
    return dataUrl
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error(`${LOG_PREFIX} avatar read failed`, { code: error?.code })
    return undefined
  }
}

/**
 * Turn a configured avatar value into the URL the account UI can load.
 * Plain http(s) and legacy data: URLs pass through; `dsh-file:` references are
 * read from disk; a missing file clears the avatar instead of breaking the profile.
 * @param value - configured avatar value.
 * @returns resolvable URL, or null when a stored file disappeared.
 */
async function resolveAvatarReference(value) {
  if (typeof value !== 'string' || !value.startsWith(AVATAR_REF_PREFIX)) return value ?? null
  return (await readAvatarDataUrl(value.slice(AVATAR_REF_PREFIX.length))) ?? null
}

/** Write one JSON response. */
function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

/** Read one bounded JSON request body. */
async function readJsonBody(request) {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    const error = new Error('expected application/json')
    error.statusCode = 415
    throw error
  }
  const declared = Number(request.headers['content-length'] ?? '')
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BODY) {
    const error = new Error('payload too large')
    error.statusCode = 413
    throw error
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_UPLOAD_BODY) {
      const error = new Error('payload too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (_error) {
    const error = new Error('invalid JSON')
    error.statusCode = 400
    throw error
  }
}

/**
 * Register the avatar upload and read routes on the Web host.
 *
 * `POST /account-identity-fallback/avatar` accepts `{ data: 'data:image/...' }`,
 * stores the bytes under the plugin data directory and returns `{ ref }`.
 * `GET|HEAD /account-identity-fallback/avatar/<file>` serves a stored file
 * (used for the settings preview).
 * @param webServer - Web host route registry.
 * @returns the route disposer.
 */
function registerAvatarRoutes(webServer) {
  const prefix = '/account-identity-fallback/avatar/'
  const handler = async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
      if (url.pathname === '/account-identity-fallback/avatar') {
        if (request.method !== 'POST') return sendJson(response, 405, { error: 'method not allowed' })
        const body = await readJsonBody(request)
        const decoded = decodeAvatarData(body?.data)
        if (decoded === undefined) return sendJson(response, 400, { error: 'invalid image data' })
        const ref = await storeAvatar(decoded.bytes, decoded.ext)
        return sendJson(response, 200, { ref })
      }
      if (url.pathname.startsWith(prefix) && (request.method === 'GET' || request.method === 'HEAD')) {
        const file = decodeURIComponent(url.pathname.slice(prefix.length))
        if (!AVATAR_NAME.test(file)) return sendJson(response, 404, { error: 'not found' })
        const target = join(AVATAR_DIR, file)
        try {
          const info = await stat(target)
          const ext = file.slice(file.lastIndexOf('.') + 1)
          response.writeHead(200, {
            'content-type': AVATAR_MIME[ext] ?? 'application/octet-stream',
            'content-length': String(info.size),
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
          })
          if (request.method === 'HEAD') return response.end()
          response.end(await readFile(target))
        } catch (_error) {
          return sendJson(response, 404, { error: 'not found' })
        }
        return
      }
      return sendJson(response, 404, { error: 'not found' })
    } catch (error) {
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
      if (status === 500) console.error(`${LOG_PREFIX} avatar route failed`, { code: error?.code })
      if (!response.headersSent) return sendJson(response, status, { error: status === 500 ? 'internal error' : String(error?.message ?? 'error') })
      response.end()
    }
  }
  return webServer.register({ kind: 'prefix', path: '/account-identity-fallback', handler })
}

/** 
 * Install the profile-read adapter.
 * @param ctx - Host context owning the account service.
 * @param config - volatile identity configuration; `name`, `contact`, `avatarUrl`, `id`.
 */
export function apply(ctx, config) {
  // Uploaded avatars are files, not configuration values: these routes move the
  // image bytes from the browser into the plugin data directory and back.
  ctx.inject(['webServer'], (web) => {
    web.effect(() => registerAvatarRoutes(web.webServer), 'account-identity-fallback: avatar routes')
  })

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
      if (profile !== undefined) {
        const avatarUrl = await resolveAvatarReference(profile.avatarUrl)
        return { status: 'ready', value: avatarUrl === profile.avatarUrl ? profile : { ...profile, avatarUrl } }
      }
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
