export function logHaptic(kind: string, style?: string) {
	console.info(`[tma] haptic → ${style ? `${kind}: ${style}` : kind}`)
}
