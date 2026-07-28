import type { Config } from '@react-router/dev/config'

// Framework mode without SSR, the same shape a real app tends to use.
export default {
	appDirectory: 'app',
	ssr: false,
} satisfies Config
