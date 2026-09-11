import { injectChromeStyles } from "@bpmnkit/editor"

export const CONNECTOR_CATALOG_STYLE_ID = "bpmnkit-connector-catalog-v1"

export const CONNECTOR_CATALOG_CSS = `
/* ── Catalog panel overlay ───────────────────────────────────────────────── */
.bpmnkit-cc-panel-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bpmnkit-chrome-scrim);
  z-index: 99990;
  animation: bpmnkit-cc-fadein 0.12s ease;
}
.bpmnkit-cc-panel {
  display: flex;
  flex-direction: column;
  width: min(720px, 92vw);
  max-height: 80vh;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  overflow: hidden;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
  color: var(--bpmnkit-chrome-ink);
}
/* Header */
.bpmnkit-cc-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.bpmnkit-cc-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-cc-panel__close {
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 6px;
  transition: color 0.1s, background 0.1s;
}
.bpmnkit-cc-panel__close:hover {
  color: var(--bpmnkit-chrome-ink);
  background: var(--bpmnkit-chrome-ground-2);
}
/* Search */
.bpmnkit-cc-panel__search {
  padding: 12px 16px 0;
  flex-shrink: 0;
}
.bpmnkit-cc-panel__search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bpmnkit-chrome-ground-2);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  padding: 7px 10px;
  transition: border-color 0.15s;
}
.bpmnkit-cc-panel__search-input:focus {
  border-color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-cc-panel__search-input::placeholder {
  color: var(--bpmnkit-chrome-ink-4);
}
/* Tabs */
.bpmnkit-cc-panel__tabs {
  display: flex;
  gap: 2px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.bpmnkit-cc-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: -1px;
  padding: 6px 12px 8px;
  transition: color 0.1s, border-color 0.1s;
}
.bpmnkit-cc-tab:hover {
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-cc-tab--active {
  border-bottom-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}
/* Content */
.bpmnkit-cc-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
/* Built-in card grid */
.bpmnkit-cc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.bpmnkit-cc-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bpmnkit-chrome-ground-2);
  border: 1px solid var(--bpmnkit-chrome-line);
  cursor: pointer;
  padding: 12px;
  transition: border-color 0.15s, background 0.15s;
}
.bpmnkit-cc-card:hover {
  border-color: var(--bpmnkit-chrome-accent);
  background: var(--bpmnkit-chrome-accent-subtle);
}
.bpmnkit-cc-card__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.bpmnkit-cc-card__icon svg {
  width: 20px;
  height: 20px;
}
.bpmnkit-cc-card__body {
  flex: 1;
}
.bpmnkit-cc-card__name {
  font-weight: 600;
  font-size: 13px;
  color: var(--bpmnkit-chrome-ink);
  margin-bottom: 3px;
}
.bpmnkit-cc-card__desc {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bpmnkit-cc-card__use {
  align-self: flex-start;
  background: var(--bpmnkit-chrome-accent);
  border: none;
  color: var(--bpmnkit-chrome-accent-fg);
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  transition: opacity 0.1s;
}
.bpmnkit-cc-card__use:hover {
  opacity: 0.85;
}
/* Community row list */
.bpmnkit-cc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bpmnkit-cc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bpmnkit-chrome-ground-2);
  border: 1px solid var(--bpmnkit-chrome-line);
  cursor: pointer;
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
}
.bpmnkit-cc-row:hover {
  border-color: var(--bpmnkit-chrome-accent);
  background: var(--bpmnkit-chrome-accent-subtle);
}
.bpmnkit-cc-row__body {
  flex: 1;
  min-width: 0;
}
.bpmnkit-cc-row__name {
  font-weight: 600;
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-cc-row__desc {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-cc-row__import {
  background: none;
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  font-size: 11px;
  padding: 4px 10px;
  transition: border-color 0.1s, color 0.1s;
  white-space: nowrap;
}
.bpmnkit-cc-row__import:hover {
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}
/* Empty state */
.bpmnkit-cc-empty {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 13px;
  padding: 32px 0;
  text-align: center;
}
/* Footer */
.bpmnkit-cc-panel__footer {
  border-top: 1px solid var(--bpmnkit-chrome-line);
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  flex-shrink: 0;
}
.bpmnkit-cc-footer-btn {
  background: none;
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  padding: 5px 12px;
  transition: border-color 0.1s, color 0.1s;
}
.bpmnkit-cc-footer-btn:hover {
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}
/* ── Toast notifications ─────────────────────────────────────────────────── */
.bpmnkit-cc-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
  font-weight: 500;
  z-index: 99999;
  animation: bpmnkit-cc-fadein 0.15s ease;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
@keyframes bpmnkit-cc-fadein {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.bpmnkit-cc-toast--loading {
  background: var(--bpmnkit-chrome-ground-2);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-cc-toast--success {
  background: var(--bpmnkit-success, #16a34a);
  border: 1px solid var(--bpmnkit-success, #16a34a);
  color: var(--bpmnkit-success, #22c55e);
}
.bpmnkit-cc-toast--error {
  background: var(--bpmnkit-danger, #dc2626);
  border: 1px solid var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #f87171);
}

/* ── Detail view ─────────────────────────────────────────────────────────── */
.bpmnkit-cc-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.bpmnkit-cc-detail__back {
  align-self: flex-start;
  padding: 4px 8px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.bpmnkit-cc-detail__back:hover {
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-cc-detail__title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bpmnkit-cc-detail__icon {
  display: flex;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
}
.bpmnkit-cc-detail__icon img,
.bpmnkit-cc-detail__icon svg {
  max-width: 100%;
  max-height: 100%;
}
.bpmnkit-cc-detail__name {
  font-size: 16px;
  font-weight: 600;
}
.bpmnkit-cc-detail__id,
.bpmnkit-cc-detail__desc {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 12px;
}
.bpmnkit-cc-detail__binding {
  display: grid;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-ground-2);
  column-gap: 12px;
  grid-template-columns: max-content 1fr;
  row-gap: 4px;
}
.bpmnkit-cc-detail__binding dt {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 12px;
}
.bpmnkit-cc-detail__binding dd {
  margin: 0;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12px;
}
.bpmnkit-cc-detail__section-title {
  font-family: var(--bpmnkit-chrome-mono);
  margin-bottom: 6px;
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.bpmnkit-cc-field {
  padding: 6px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-cc-field:last-child {
  border-bottom: none;
}
.bpmnkit-cc-field__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.bpmnkit-cc-field__req {
  color: var(--bpmnkit-danger, #f87171);
}
.bpmnkit-cc-field__secret,
.bpmnkit-cc-field__feel {
  font-family: var(--bpmnkit-chrome-mono);
  padding: 1px 5px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bpmnkit-cc-field__secret {
  background: var(--bpmnkit-warn, #d97706);
  color: var(--bpmnkit-warn, #f59e0b);
}
.bpmnkit-cc-field__feel {
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-cc-field__meta,
.bpmnkit-cc-field__desc {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 11px;
}
.bpmnkit-cc-field__meta {
  font-family: var(--bpmnkit-chrome-mono);
}
.bpmnkit-cc-detail__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.bpmnkit-cc-detail__docs {
  color: var(--bpmnkit-chrome-accent);
  font-size: 12px;
}
.bpmnkit-cc-detail__apply {
  padding: 6px 16px;
  border: none;
  background: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}
`

export function injectConnectorCatalogStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(CONNECTOR_CATALOG_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = CONNECTOR_CATALOG_STYLE_ID
	style.textContent = CONNECTOR_CATALOG_CSS
	document.head.appendChild(style)
}
