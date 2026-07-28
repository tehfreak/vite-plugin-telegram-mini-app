import { useEffect, useState } from 'react'

type WebApp = {
	initData: string
	initDataUnsafe: { user?: { id: number; first_name: string; username?: string } }
	platform: string
	viewportHeight: number
	ready(): void
	BackButton: { show(): void; hide(): void; onClick(cb: () => void): void }
	MainButton: { setParams(params: { text?: string; is_visible?: boolean }): void; onClick(cb: () => void): void }
}

const webApp = () => (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp

export default function Home() {
	const [state, setState] = useState('loading…')

	useEffect(() => {
		const app = webApp()
		app?.ready()
		setState(
			JSON.stringify(
				{
					hasWebApp: Boolean(app),
					initDataLength: app?.initData.length ?? 0,
					user: app?.initDataUnsafe.user ?? null,
					platform: app?.platform,
					viewportHeight: app?.viewportHeight,
				},
				null,
				2,
			),
		)
	}, [])

	return (
		<main style={{ fontFamily: 'sans-serif', padding: '16px 16px 80px', maxWidth: 640 }}>
			<h1 style={{ fontSize: 20 }}>react-router 8 · framework mode</h1>
			<p style={{ fontSize: 13, color: '#707579' }}>react-router generates the HTML, not an index.html.</p>
			<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, background: '#f4f4f5', padding: 12, borderRadius: 8 }}>{state}</pre>
			<button
				type="button"
				onClick={() => {
					const app = webApp()
					app?.BackButton.show()
					app?.BackButton.onClick(() => {
						app.BackButton.hide()
						alert('BackButton clicked')
					})
				}}
			>
				BackButton.show()
			</button>
			<button
				type="button"
				onClick={() => {
					const app = webApp()
					app?.MainButton.setParams({ text: 'PAY', is_visible: true })
					app?.MainButton.onClick(() => alert('MainButton clicked'))
				}}
			>
				MainButton.show()
			</button>
		</main>
	)
}
