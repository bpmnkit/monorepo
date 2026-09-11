/** Injects a CSS string into `<head>` exactly once, keyed by id. */
export function injectStyle(id: string, css: string): void {
	if (typeof document === "undefined") return
	if (document.getElementById(id)) return
	const style = document.createElement("style")
	style.id = id
	style.textContent = css
	document.head.appendChild(style)
}
