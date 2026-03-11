import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

export function createDefinitionsView(
	store: DefinitionsStore,
	onSelect: (def: ProcessDefinitionResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	// Toolbar
	const toolbar = document.createElement("div")
	toolbar.className = "op-toolbar"
	const searchInput = document.createElement("input")
	searchInput.type = "text"
	searchInput.className = "op-search"
	searchInput.placeholder = "Search processes…"
	toolbar.appendChild(searchInput)
	const countEl = document.createElement("span")
	countEl.className = "op-search-count"
	toolbar.appendChild(countEl)
	el.appendChild(toolbar)

	// Groups container
	const groupsEl = document.createElement("div")
	groupsEl.className = "op-def-groups"
	el.appendChild(groupsEl)

	// Track collapsed state per processDefinitionId
	const collapsed = new Map<string, boolean>()

	function buildGroups(items: ProcessDefinitionResult[]): Map<string, ProcessDefinitionResult[]> {
		const map = new Map<string, ProcessDefinitionResult[]>()
		for (const item of items) {
			const id = item.processDefinitionId ?? item.processDefinitionKey ?? ""
			const existing = map.get(id)
			if (existing) {
				existing.push(item)
			} else {
				map.set(id, [item])
			}
		}
		// Sort each group by version descending (latest first)
		for (const versions of map.values()) {
			versions.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
		}
		return map
	}

	function render(): void {
		const items = store.state.data?.items ?? []
		const query = searchInput.value.toLowerCase()

		// Filter
		const filtered = query
			? items.filter(
					(d) =>
						(d.name ?? "").toLowerCase().includes(query) ||
						(d.processDefinitionId ?? "").toLowerCase().includes(query),
				)
			: items

		const groups = buildGroups(filtered)

		// Update count
		countEl.textContent = String(groups.size)

		groupsEl.innerHTML = ""

		if (groups.size === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmn-table-empty"
			empty.textContent = query ? "No results" : "No process definitions deployed"
			groupsEl.appendChild(empty)
			return
		}

		// Table-like header
		const header = document.createElement("div")
		header.className = "bpmn-table-header op-def-header"
		header.innerHTML = `
			<div class="bpmn-table-th" style="flex:1">Name</div>
			<div class="bpmn-table-th" style="width:160px">ID</div>
			<div class="bpmn-table-th" style="width:80px">Versions</div>
			<div class="bpmn-table-th" style="width:100px">Latest</div>
		`
		groupsEl.appendChild(header)

		for (const [id, versions] of groups) {
			const isCollapsed = collapsed.get(id) ?? true
			const latest = versions[0]
			if (!latest) continue
			const name = latest.name ?? id

			const group = document.createElement("div")
			group.className = "op-def-group"

			// Group header row
			const groupRow = document.createElement("div")
			groupRow.className = "op-def-group-row"

			const chevron = document.createElement("span")
			chevron.className = `op-def-chevron${isCollapsed ? "" : " op-def-chevron--open"}`
			chevron.textContent = "›"
			groupRow.appendChild(chevron)

			const nameEl = document.createElement("span")
			nameEl.className = "op-def-name"
			nameEl.textContent = name
			groupRow.appendChild(nameEl)

			const idEl = document.createElement("span")
			idEl.className = "op-def-group-id"
			idEl.textContent = id
			groupRow.appendChild(idEl)

			const countSpan = document.createElement("span")
			countSpan.className = "op-def-count"
			countSpan.textContent = String(versions.length)
			groupRow.appendChild(countSpan)

			const tagEl = document.createElement("span")
			tagEl.className = "op-def-version-tag"
			tagEl.textContent = latest.versionTag ?? `v${latest.version ?? "?"}`
			groupRow.appendChild(tagEl)

			groupRow.addEventListener("click", () => {
				collapsed.set(id, !collapsed.get(id))
				render()
			})
			group.appendChild(groupRow)

			// Version rows (shown when not collapsed)
			if (!isCollapsed) {
				const versionsEl = document.createElement("div")
				versionsEl.className = "op-def-versions"
				for (const def of versions) {
					const vRow = document.createElement("div")
					vRow.className = "op-def-version-row"

					const vNum = document.createElement("span")
					vNum.className = "op-def-version-num"
					vNum.textContent = `v${def.version ?? "?"}`
					vRow.appendChild(vNum)

					const vTag = document.createElement("span")
					vTag.className = "op-def-version-tag"
					vTag.textContent = def.versionTag ?? ""
					vRow.appendChild(vTag)

					const vKey = document.createElement("span")
					vKey.className = "op-def-version-key"
					vKey.textContent = def.processDefinitionKey ?? ""
					vRow.appendChild(vKey)

					vRow.addEventListener("click", () => onSelect(def))
					versionsEl.appendChild(vRow)
				}
				group.appendChild(versionsEl)
			}

			groupsEl.appendChild(group)
		}
	}

	searchInput.addEventListener("input", render)
	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
