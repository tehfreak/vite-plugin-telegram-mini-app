# vite-plugin-telegram-mini-app

Run a Telegram Mini App in a plain browser during development, with a debug panel that also works
inside Telegram.

The dev server signs a real `initData` with your bot token and installs a `window.Telegram.WebApp`
façade. The signature is genuine, so the backend accepts it with no dev flag and no skipped
validation. Inside a real Telegram webview the plugin installs nothing and the panel becomes a
read-only inspector.

## Install

```bash
npm i -D vite-plugin-telegram-mini-app
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tma } from 'vite-plugin-telegram-mini-app'

export default defineConfig({
	plugins: [
		tma({
			users: [
				{ id: 1001, first_name: 'Alice', last_name: 'Adams', username: 'example_telegram_alice' },
				{ id: 1002, first_name: 'Bob', username: 'example_telegram_bob' },
			],
		}),
	],
})
```

The token is read from `TELEGRAM_BOT_TOKEN` in the dev machine's environment. Signing happens in
Node; the token never reaches the browser.

A draggable button appears in the corner. Clicking it opens the panel, which has three tabs:

- **Identity** switches between the users you passed, an unregistered guest with a random id, and
  anonymous. Anonymous means an empty `initData`, which is what Telegram itself sends for
  keyboard-button and inline-mode launches.
- **Environment** holds browser mode, theme, a simulated keyboard, an expired signature, platform and
  version.
- **Data** shows the signed `initData` parsed by field, a live snapshot of `window.Telegram.WebApp`,
  and a copy button.

Theme and keyboard apply immediately and fire `themeChanged` / `viewportChanged`. The rest changes
the signature, so the page reloads. Selections persist across reloads until reset.

Two of those states deserve a note. **Browser mode** installs no mock at all, so the app takes its
"not in Telegram" path: `isTMA()` is false and `retrieveLaunchParams()` throws. **Expired signature**
keeps the hash valid but dates `auth_date` a day back, so a correct backend rejects it.

The roster is fetched when the panel opens rather than inlined into every page, since `users` may
query a database. Search runs on the server and returns the first 20 matches.

## Inspector in production

The inspector reads the environment and fakes nothing, so it also works in a built app. It is a
separate entry point that your code mounts itself:

```ts
const { mountInspector } = await import('vite-plugin-telegram-mini-app/inspector')
mountInspector({ eruda: () => import('eruda') })
```

It shows `initData`, launch params, theme, viewport and safe area, and can open an
[eruda](https://github.com/liriliri/eruda) console. On a phone that is usually the only way to see
any of it.

The plugin performs no access checks: gate the import by role, a stored flag or anything else you
prefer. Note that the panel shows the user their own `initData` and offers to copy it.

Mock code cannot reach this entry point: the switcher, the `WebApp` façade and the SDK glue are not
imported from it, and a test walks the built import graph to keep it that way.

## Options

| Option      | Default                          | Meaning                                                |
| ----------- | -------------------------------- | ------------------------------------------------------ |
| `botToken`  | `process.env.TELEGRAM_BOT_TOKEN` | Signing key. Without it `initData` is empty            |
| `users`     | `[]`                             | Array or function (async allowed) returning the roster |
| `mode`      | `'auto'`                         | `webapp`, `sdk`, or `auto` by detected packages        |
| `sdkModule` | detected                         | Which package to take `mockTelegramEnv` from           |
| `theme`     | `'auto'`                         | `light`, `dark`, or follow `prefers-color-scheme`      |
| `platform`  | `'tdesktop'`                     | `WebApp.platform`                                      |
| `version`   | `'7.0'`                          | `WebApp.version`                                       |
| `panel`     | `true`                           | Show the panel                                         |
| `eruda`     | `true`                           | Show the console button; eruda loads on click          |
| `stateFile` | Vite cache                       | Where the selected identity is stored                  |

`users` runs in Node, so the roster can come from your database:

```ts
tma({ users: async () => (await import('./server/src/db/user.js')).listUsers() })
```

## SDK mode

Apps built on `@tma.js/sdk` or `@telegram-apps/sdk` never read `window.Telegram.WebApp`. For them the
plugin calls `mockTelegramEnv` from the package the app itself has installed and passes the signed
`initData` into it. Buttons still render: the plugin intercepts `web_app_setup_main_button` and
`web_app_setup_back_button` and sends clicks back as events, and answers theme, viewport and
safe-area requests locally.

Both package generations are supported; they differ in the shape of the `onEvent` callback and the
plugin accepts either. If both are installed, set `sdkModule` explicitly.

## Frameworks without an `index.html`

Apps with an `index.html` get the script through `transformIndexHtml`. Frameworks that render the
document themselves never call that hook, so the plugin also intercepts the HTML response. This is
what makes react-router in framework mode work.

## Limitations

- The `signature` field is signed with Telegram's ed25519 key and cannot be produced here. A backend
  that verifies it instead of the HMAC `hash` will reject the mock.
- Every served HTML gets the signature inlined, including responses going out through a public
  tunnel. Skipping injection for non-local hosts is not implemented yet.
- Signing is local. There is no service to hand out access without handing out the bot token.

## Development

```bash
npm run build
npm test
npm run playground:webapp     # raw window.Telegram.WebApp
npm run playground:sdk        # @telegram-apps/sdk
npm run playground:tmajs      # @tma.js/sdk
npm run playground:rr         # react-router 8, framework mode
npm run playground:inspector  # no plugin: the app mounts the inspector itself
```

Playgrounds are npm workspaces and consume the plugin by name, so they exercise the published
`exports` map.

## License

MIT.

The panel icon is from [Solar](https://www.figma.com/community/file/1166831539721848736) by 480
Design, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
