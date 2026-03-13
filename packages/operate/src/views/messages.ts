import { badge } from "../components/badge.js"
import { createFilterTable } from "../components/filter-table.js"
import { MOCK_MESSAGE_SUBSCRIPTIONS } from "../mock-data.js"
import type { MessageSubscriptionResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
}

interface FormField {
	key: string
	label: string
	placeholder?: string
	required?: boolean
	hint?: string
	type?: "text" | "textarea" | "number"
}

function relTime(iso: string | null | undefined): string {
	if (!iso) return "—"
	const diff = Date.now() - new Date(iso).getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	return `${Math.floor(h / 24)}d ago`
}

function parseVariables(raw: string): Record<string, unknown> | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const parsed: unknown = JSON.parse(trimmed)
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>
		}
		return null
	} catch {
		return null
	}
}

function showFormModal(
	container: HTMLElement,
	title: string,
	fields: FormField[],
	submitLabel: string,
	onSubmit: (values: Record<string, string>) => Promise<string>,
): void {
	const overlay = document.createElement("div")
	overlay.className = "op-modal-overlay"

	const dialog = document.createElement("div")
	dialog.className = "op-modal op-modal--form"

	const header = document.createElement("div")
	header.className = "op-modal-header"

	const titleEl = document.createElement("span")
	titleEl.className = "op-modal-title"
	titleEl.textContent = title
	header.appendChild(titleEl)

	const closeBtn = document.createElement("button")
	closeBtn.className = "op-modal-close"
	closeBtn.textContent = "✕"
	closeBtn.addEventListener("click", () => overlay.remove())
	header.appendChild(closeBtn)

	const body = document.createElement("div")
	body.className = "op-modal-form-body"

	const inputMap = new Map<string, HTMLInputElement | HTMLTextAreaElement>()

	for (const field of fields) {
		const group = document.createElement("div")
		group.className = "op-form-group"

		const label = document.createElement("label")
		label.className = "op-form-label"
		label.textContent = field.required ? `${field.label} *` : field.label

		let input: HTMLInputElement | HTMLTextAreaElement
		if (field.type === "textarea") {
			const ta = document.createElement("textarea")
			ta.className = "op-form-textarea"
			ta.placeholder = field.placeholder ?? ""
			ta.rows = 4
			input = ta
		} else {
			const inp = document.createElement("input")
			inp.type = field.type === "number" ? "number" : "text"
			inp.className = "op-form-input"
			inp.placeholder = field.placeholder ?? ""
			input = inp
		}

		inputMap.set(field.key, input)
		group.appendChild(label)
		group.appendChild(input)

		if (field.hint) {
			const hint = document.createElement("span")
			hint.className = "op-form-hint"
			hint.textContent = field.hint
			group.appendChild(hint)
		}

		body.appendChild(group)
	}

	const footer = document.createElement("div")
	footer.className = "op-modal-form-footer"

	const errorEl = document.createElement("div")
	errorEl.className = "op-form-error"
	errorEl.style.display = "none"
	footer.appendChild(errorEl)

	const feedbackEl = document.createElement("div")
	feedbackEl.className = "op-action-feedback"
	feedbackEl.style.display = "none"
	footer.appendChild(feedbackEl)

	const cancelBtn = document.createElement("button")
	cancelBtn.className = "op-action-btn"
	cancelBtn.textContent = "Cancel"
	cancelBtn.style.marginLeft = "auto"
	cancelBtn.addEventListener("click", () => overlay.remove())
	footer.appendChild(cancelBtn)

	const submitBtn = document.createElement("button")
	submitBtn.className = "op-action-btn op-action-btn--primary"
	submitBtn.textContent = submitLabel
	footer.appendChild(submitBtn)

	submitBtn.addEventListener("click", () => {
		errorEl.style.display = "none"

		// Validate required fields
		const values: Record<string, string> = {}
		for (const field of fields) {
			const input = inputMap.get(field.key)
			const value = input?.value.trim() ?? ""
			if (field.required && !value) {
				errorEl.textContent = `${field.label} is required.`
				errorEl.style.display = ""
				input?.focus()
				return
			}
			values[field.key] = value
		}

		submitBtn.disabled = true
		cancelBtn.disabled = true
		submitBtn.textContent = "Submitting…"

		onSubmit(values)
			.then((successMsg) => {
				feedbackEl.textContent = successMsg
				feedbackEl.className = "op-action-feedback op-action-feedback--ok"
				feedbackEl.style.display = ""
				submitBtn.style.display = "none"
				cancelBtn.disabled = false
				cancelBtn.textContent = "Close"
			})
			.catch((err: unknown) => {
				errorEl.textContent = String(err)
				errorEl.style.display = ""
				submitBtn.disabled = false
				cancelBtn.disabled = false
				submitBtn.textContent = submitLabel
			})
	})

	dialog.appendChild(header)
	dialog.appendChild(body)
	dialog.appendChild(footer)
	overlay.appendChild(dialog)
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})
	container.appendChild(overlay)

	const firstInput = fields[0] ? inputMap.get(fields[0].key) : null
	if (firstInput) setTimeout(() => firstInput.focus(), 0)
}

function showSubDetailModal(container: HTMLElement, sub: MessageSubscriptionResult): void {
	const overlay = document.createElement("div")
	overlay.className = "op-modal-overlay"

	const dialog = document.createElement("div")
	dialog.className = "op-modal op-modal--form"

	const header = document.createElement("div")
	header.className = "op-modal-header"

	const titleEl = document.createElement("span")
	titleEl.className = "op-modal-title"
	titleEl.textContent = sub.messageName ?? "Message Subscription"
	header.appendChild(titleEl)

	const closeBtn = document.createElement("button")
	closeBtn.className = "op-modal-close"
	closeBtn.textContent = "✕"
	closeBtn.addEventListener("click", () => overlay.remove())
	header.appendChild(closeBtn)

	const body = document.createElement("div")
	body.className = "op-kv-body"

	const fields: Array<[string, string | null | undefined]> = [
		["State", sub.messageSubscriptionState],
		["Correlation Key", sub.correlationKey],
		["Process", sub.processDefinitionId],
		["Instance Key", sub.processInstanceKey],
		["Element ID", sub.elementId],
		["Last Updated", sub.lastUpdatedDate],
		["Tenant", sub.tenantId],
	]
	for (const [key, value] of fields) {
		const row = document.createElement("div")
		row.className = "op-kv-row"
		const keyEl = document.createElement("span")
		keyEl.className = "op-kv-key"
		keyEl.textContent = key
		row.appendChild(keyEl)
		const valEl = document.createElement("span")
		valEl.className = "op-kv-value"
		valEl.textContent = value ?? "—"
		row.appendChild(valEl)
		body.appendChild(row)
	}

	dialog.appendChild(header)
	dialog.appendChild(body)
	overlay.appendChild(dialog)
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})
	container.appendChild(overlay)
}

export function createMessagesView(cfg: Config): { el: HTMLElement; destroy(): void } {
	const el = document.createElement("div")
	el.className = "op-view op-msg-view"

	// ── Action cards ──────────────────────────────────────────────────────────

	const actionsGrid = document.createElement("div")
	actionsGrid.className = "op-msg-actions"
	el.appendChild(actionsGrid)

	const actions: Array<{
		title: string
		desc: string
		fields: FormField[]
		submitLabel: string
		endpoint: string
		buildBody: (v: Record<string, string>) => Record<string, unknown>
	}> = [
		{
			title: "✉ Correlate Message",
			desc: "Send a message to a waiting catch event by correlation key.",
			submitLabel: "Correlate",
			endpoint: "/api/messages/correlation",
			fields: [
				{
					key: "name",
					label: "Message Name",
					placeholder: "e.g. PaymentConfirmed",
					required: true,
				},
				{
					key: "correlationKey",
					label: "Correlation Key",
					placeholder: "e.g. ORD-10042",
					required: true,
				},
				{
					key: "variables",
					label: "Variables",
					placeholder: '{"amount": 99.99}',
					type: "textarea",
					hint: "Optional JSON object to pass as message variables.",
				},
			],
			buildBody: (v) => {
				const body: Record<string, unknown> = {
					name: v.name,
					correlationKey: v.correlationKey,
				}
				if (v.variables) {
					const vars = parseVariables(v.variables ?? "")
					if (vars) body.variables = vars
				}
				return body
			},
		},
		{
			title: "📨 Publish Message",
			desc: "Publish a buffered message. Correlation is optional.",
			submitLabel: "Publish",
			endpoint: "/api/messages/publication",
			fields: [
				{ key: "name", label: "Message Name", placeholder: "e.g. OrderShipped", required: true },
				{ key: "correlationKey", label: "Correlation Key", placeholder: "e.g. ORD-10042" },
				{
					key: "timeToLive",
					label: "Time to Live (ms)",
					placeholder: "e.g. 60000",
					type: "number",
					hint: "How long the message is buffered. Leave empty for default.",
				},
				{
					key: "messageId",
					label: "Message ID",
					placeholder: "Unique deduplication ID (optional)",
				},
				{
					key: "variables",
					label: "Variables",
					placeholder: '{"trackingCode": "XYZ-001"}',
					type: "textarea",
					hint: "Optional JSON object to pass as message variables.",
				},
			],
			buildBody: (v) => {
				const body: Record<string, unknown> = { name: v.name }
				if (v.correlationKey) body.correlationKey = v.correlationKey
				if (v.messageId) body.messageId = v.messageId
				if (v.timeToLive) body.timeToLive = Number(v.timeToLive)
				if (v.variables) {
					const vars = parseVariables(v.variables ?? "")
					if (vars) body.variables = vars
				}
				return body
			},
		},
		{
			title: "⚡ Broadcast Signal",
			desc: "Broadcast a signal to all matching catch events.",
			submitLabel: "Broadcast",
			endpoint: "/api/signals/broadcast",
			fields: [
				{
					key: "signalName",
					label: "Signal Name",
					placeholder: "e.g. StockReplenished",
					required: true,
				},
				{
					key: "variables",
					label: "Variables",
					placeholder: '{"sku": "ITEM-001"}',
					type: "textarea",
					hint: "Optional JSON object to pass as signal variables.",
				},
			],
			buildBody: (v) => {
				const body: Record<string, unknown> = { signalName: v.signalName }
				if (v.variables) {
					const vars = parseVariables(v.variables ?? "")
					if (vars) body.variables = vars
				}
				return body
			},
		},
	]

	for (const action of actions) {
		const card = document.createElement("button")
		card.className = "op-msg-action-card"

		const cardTitle = document.createElement("div")
		cardTitle.className = "op-msg-action-card-title"
		cardTitle.textContent = action.title
		card.appendChild(cardTitle)

		const cardDesc = document.createElement("div")
		cardDesc.className = "op-msg-action-card-desc"
		cardDesc.textContent = action.desc
		card.appendChild(cardDesc)

		const capturedAction = action
		card.addEventListener("click", () => {
			showFormModal(
				el,
				capturedAction.title,
				capturedAction.fields,
				capturedAction.submitLabel,
				(values) => {
					if (cfg.mock) {
						return Promise.resolve("Mock mode — action not sent to server.")
					}
					const body = capturedAction.buildBody(values)
					const headers: Record<string, string> = { "Content-Type": "application/json" }
					if (cfg.profile) headers["x-profile"] = cfg.profile
					return fetch(`${cfg.proxyUrl}${capturedAction.endpoint}`, {
						method: "POST",
						headers,
						body: JSON.stringify(body),
					}).then((r) => {
						if (r.ok)
							return r.json().then((data: unknown) => {
								const result = data as Record<string, unknown>
								const key = result.processInstanceKey ?? result.messageKey ?? result.signalKey
								return key ? `Success. Key: ${String(key)}` : "Success."
							})
						return r.text().then((msg) => {
							throw new Error(`${r.status}: ${msg}`)
						})
					})
				},
			)
		})

		actionsGrid.appendChild(card)
	}

	// ── Message subscriptions ─────────────────────────────────────────────────

	const subSection = document.createElement("div")
	el.appendChild(subSection)

	const subTitle = document.createElement("div")
	subTitle.className = "op-msg-section-title"
	subTitle.textContent = "Active Message Subscriptions"
	subSection.appendChild(subTitle)

	const { el: subTableEl, setRows: setSubRows } = createFilterTable<MessageSubscriptionResult>({
		columns: [
			{
				label: "Message Name",
				render: (row) => row.messageName ?? "—",
				sortValue: (row) => row.messageName ?? "",
			},
			{
				label: "Process",
				width: "160px",
				render: (row) => row.processDefinitionId ?? "—",
				sortValue: (row) => row.processDefinitionId ?? "",
			},
			{
				label: "Correlation Key",
				width: "160px",
				render: (row) => row.correlationKey ?? "—",
				sortValue: (row) => row.correlationKey ?? "",
			},
			{
				label: "State",
				width: "100px",
				render: (row) => badge(row.messageSubscriptionState ?? "UNKNOWN"),
				sortValue: (row) => row.messageSubscriptionState ?? "",
			},
			{
				label: "Updated",
				width: "90px",
				render: (row) => relTime(row.lastUpdatedDate),
				sortValue: (row) => row.lastUpdatedDate ?? "",
			},
		],
		searchFn: (row) =>
			[row.messageName, row.processDefinitionId, row.correlationKey, row.messageSubscriptionState]
				.filter(Boolean)
				.join(" "),
		onRowClick: (sub) => showSubDetailModal(el, sub),
		emptyText: "No active message subscriptions",
	})
	subSection.appendChild(subTableEl)

	function loadSubscriptions(): void {
		if (cfg.mock) {
			setSubRows(MOCK_MESSAGE_SUBSCRIPTIONS)
			return
		}
		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile
		fetch(`${cfg.proxyUrl}/api/message-subscriptions/search`, {
			method: "POST",
			headers,
			body: JSON.stringify({ filter: { messageSubscriptionState: "CREATED" } }),
		})
			.then((r) => r.json())
			.then((result: { items: MessageSubscriptionResult[] }) => {
				setSubRows(result.items ?? [])
			})
			.catch(() => setSubRows([]))
	}

	loadSubscriptions()

	return { el, destroy(): void {} }
}
