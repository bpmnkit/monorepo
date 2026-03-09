export type BinaryOp =
	| "+"
	| "-"
	| "*"
	| "/"
	| "**"
	| "="
	| "!="
	| "<"
	| "<="
	| ">"
	| ">="
	| "and"
	| "or"

export type FeelNode = { start: number; end: number } & FeelNodeKind

type FeelNodeKind =
	// Literals
	| { kind: "number"; value: number }
	| { kind: "string"; value: string }
	| { kind: "boolean"; value: boolean }
	| { kind: "null" }
	| { kind: "temporal"; raw: string }
	// References
	| { kind: "name"; name: string }
	// Collections
	| { kind: "list"; items: FeelNode[] }
	| { kind: "context"; entries: Array<{ key: string; value: FeelNode }> }
	// Range (low/high are the bound expressions; start/end are position fields on the outer type)
	| {
			kind: "range"
			startIncluded: boolean
			low: FeelNode
			high: FeelNode
			endIncluded: boolean
	  }
	// Operators
	| { kind: "unary-minus"; operand: FeelNode }
	| { kind: "binary"; op: BinaryOp; left: FeelNode; right: FeelNode }
	// Access
	| { kind: "path"; base: FeelNode; key: string }
	| { kind: "filter"; base: FeelNode; condition: FeelNode }
	// Calls
	| { kind: "call"; callee: string; args: FeelNode[] }
	| { kind: "call-named"; callee: string; args: Array<{ name: string; value: FeelNode }> }
	// Control flow
	| { kind: "if"; condition: FeelNode; then: FeelNode; else: FeelNode }
	| {
			kind: "for"
			bindings: Array<{ name: string; domain: FeelNode }>
			body: FeelNode
	  }
	| {
			kind: "some" | "every"
			bindings: Array<{ name: string; domain: FeelNode }>
			satisfies: FeelNode
	  }
	// Tests
	| { kind: "between"; value: FeelNode; low: FeelNode; high: FeelNode }
	| { kind: "in-test"; value: FeelNode; test: FeelNode }
	| { kind: "instance-of"; value: FeelNode; typeName: string }
	// Functions
	| { kind: "function-def"; params: string[]; body: FeelNode }
	// Unary-test mode
	| { kind: "unary-test-list"; tests: FeelNode[] }
	| { kind: "unary-not"; tests: FeelNode[] }
	| { kind: "any-input" }
