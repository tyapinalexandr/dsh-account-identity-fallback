# @tyapinalexandr/dsh-account-identity-fallback

Keeps the DeepSeek account name and avatar visible when the Platform profile
endpoint is unavailable, with an in-app editor for both.

## What it does

The account UI shows the generic avatar and "Signed in to DeepSeek" when
`platform.deepseek.com/auth-api/v0/users/current` is blocked (AWS WAF
challenge / CloudFront 403). The plugin wraps the `deepseekAccount` service: a
successful profile read is cached, and a failed read is answered from that
cache or from the identity saved in the plugin settings. It does not bypass bot
protection; balance, sign-in/out and model calls are untouched.

## Install

Plugins → Add plugin → `@tyapinalexandr/dsh-account-identity-fallback` →
Install → Enable now.

```sh
dsh plugin --profile <profile> add @tyapinalexandr/dsh-account-identity-fallback
```

After installing or updating, reload the Harness page once so the browser half
loads.

## Configure

Plugins → Installed plugins → the plugin's page: set **Account name** and
**Avatar** (an image URL, or a local file that is downscaled and stored under
`$DSH_HOME/account-identity-fallback/avatars`; the profile keeps only a short
`dsh-file:` reference), then **Save**. Saved fields apply immediately without a restart
and take priority over the cached profile; empty fields use the cached value.

The same two fields can be set in the profile's `cordis.patch.yml` (`name`,
`avatarUrl`).

## Cache

`$DSH_HOME/cache/account-identity-fallback/profile-cache.json`
(`~/.dsh/cache/...` by default). Delete it to fall back to the configured
identity.

Uploaded avatar files: `$DSH_HOME/account-identity-fallback/avatars/`.

## Uninstall

Plugins → Remove, or:

```sh
dsh plugin --profile <profile> remove @tyapinalexandr/dsh-account-identity-fallback
```

---

## Русский

Показывает имя и аватар аккаунта DeepSeek, когда платформа не отдаёт профиль,
и позволяет задать их в интерфейсе DSH.

### Что делает

Аккаунт показывает стандартную иконку и «Signed in to DeepSeek», когда
`platform.deepseek.com/auth-api/v0/users/current` блокируется (AWS WAF challenge
/ CloudFront 403). Плагин оборачивает сервис `deepseekAccount`: успешное чтение
профиля кешируется, неуспешное — отвечает из кеша или из настроек плагина.
Антибот-защиту он не обходит; баланс, вход/выход и вызовы моделей не
затрагиваются.

### Установка

**Plugins → Add plugin** → `@tyapinalexandr/dsh-account-identity-fallback` →
**Install** → **Enable now**.

```sh
dsh plugin --profile <профиль> add @tyapinalexandr/dsh-account-identity-fallback
```

После установки или обновления один раз перезагрузите страницу Harness, чтобы
загрузилась браузерная часть.

### Настройка

**Plugins → Installed plugins** → страница плагина: задайте **Имя в аккаунте**
и **Аватар** (ссылка или локальный файл: он уменьшается и сохраняется в
`$DSH_HOME/account-identity-fallback/avatars`, а в профиле остаётся короткая
ссылка `dsh-file:`), затем **Сохранить**. Сохранённые поля применяются сразу, без
перезапуска, и имеют приоритет над кешем; пустые поля используют кеш.

Те же два поля можно задать в `cordis.patch.yml` профиля (`name`,
`avatarUrl`).

### Кеш

`$DSH_HOME/cache/account-identity-fallback/profile-cache.json` (по умолчанию
`~/.dsh/cache/...`). Удалите файл, чтобы вернуться к значениям из настроек.

Файлы загруженных аватаров: `$DSH_HOME/account-identity-fallback/avatars/`.

### Удаление

**Plugins → Remove** или:

```sh
dsh plugin --profile <профиль> remove @tyapinalexandr/dsh-account-identity-fallback
```
