import { Links, Meta, Outlet, Scripts } from 'react-router'

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ru">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>tma playground · react-router 8</title>
				<script src="https://telegram.org/js/telegram-web-app.js" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}
