import type { LogLevel, LoggerConfig } from "./types.js"

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	none: 4,
}

export interface Logger {
	debug(message: string, data?: unknown): void
	info(message: string, data?: unknown): void
	warn(message: string, data?: unknown): void
	error(message: string, data?: unknown): void
}

const defaultSink = (level: LogLevel, message: string, data?: unknown): void => {
	const ts = new Date().toISOString()
	const prefix = `[camunda-api] [${ts}] [${level.toUpperCase()}] ${message}`
	if (data !== undefined) {
		/* eslint-disable no-console */
		console[
			level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "log"
		](prefix, data)
	} else {
		console[
			level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "log"
		](prefix)
	}
}

export function createLogger(config?: LoggerConfig): Logger {
	const minLevel = LEVELS[config?.level ?? "info"]
	const sink = config?.sink ?? defaultSink

	const log = (level: LogLevel, message: string, data?: unknown): void => {
		if (LEVELS[level] >= minLevel) {
			sink(level, message, data)
		}
	}

	return {
		debug: (m, d) => log("debug", m, d),
		info: (m, d) => log("info", m, d),
		warn: (m, d) => log("warn", m, d),
		error: (m, d) => log("error", m, d),
	}
}
