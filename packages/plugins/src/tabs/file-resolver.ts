import type { DmnDefinitions, FormDefinition } from "@bpmn-sdk/core";

/** A resolved file that can be opened in a tab. */
export type ResolvedFile =
	| { type: "bpmn"; xml: string; name?: string }
	| { type: "dmn"; defs: DmnDefinitions; name?: string }
	| { type: "form"; form: FormDefinition; name?: string };

/**
 * Pluggable interface for resolving DMN decision IDs and Form IDs to their content.
 *
 * The default implementation (`InMemoryFileResolver`) keeps all files in-memory.
 * Replace with a custom implementation for other environments:
 * - Local file system (Electron / offline app): read from disk
 * - SaaS: fetch from API/database
 * - Version control: fetch from Git object store
 */
export interface FileResolver {
	/**
	 * Resolve a DMN decision ID to its parent DmnDefinitions.
	 * Returns `null` if the decision is not registered.
	 */
	resolveDmn(decisionId: string): DmnDefinitions | null;

	/**
	 * Resolve a Camunda Form ID to its FormDefinition.
	 * Returns `null` if the form is not registered.
	 */
	resolveForm(formId: string): FormDefinition | null;

	/**
	 * Resolve a BPMN process/definition ID to its XML string.
	 * Returns `null` if the process is not registered.
	 */
	resolveBpmn(processId: string): string | null;
}

/**
 * In-memory implementation of `FileResolver`.
 *
 * Register files by their IDs; tabs plugin will resolve references against this store.
 *
 * @example
 * ```typescript
 * const resolver = new InMemoryFileResolver();
 * resolver.registerDmn(dmnDefs);    // keyed by each decision's id
 * resolver.registerForm(formDef);   // keyed by form.id
 * resolver.registerBpmn("proc_1", xmlString);
 *
 * const tabs = createTabsPlugin({ resolver });
 * ```
 */
export class InMemoryFileResolver implements FileResolver {
	private readonly _dmn = new Map<string, DmnDefinitions>();
	private readonly _forms = new Map<string, FormDefinition>();
	private readonly _bpmn = new Map<string, string>();

	/** Register a DMN definitions object. Each decision's id is indexed. */
	registerDmn(defs: DmnDefinitions): void {
		for (const decision of defs.decisions) {
			this._dmn.set(decision.id, defs);
		}
		// Also index by definitions id for direct lookup
		this._dmn.set(defs.id, defs);
	}

	/** Register a Camunda Form definition. */
	registerForm(form: FormDefinition): void {
		this._forms.set(form.id, form);
	}

	/** Register a BPMN XML by process/definition ID. */
	registerBpmn(id: string, xml: string): void {
		this._bpmn.set(id, xml);
	}

	resolveDmn(decisionId: string): DmnDefinitions | null {
		return this._dmn.get(decisionId) ?? null;
	}

	resolveForm(formId: string): FormDefinition | null {
		return this._forms.get(formId) ?? null;
	}

	resolveBpmn(processId: string): string | null {
		return this._bpmn.get(processId) ?? null;
	}
}
