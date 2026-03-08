// Internal SVG icon strings — not exported from index.ts
export const IC = {
	// ── Navigation tools ───────────────────────────────────────────────────
	select: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2 3 12.5 5.5 9.5 7.5 14 9.5 13.2 7.5 8.8 12 8.8z"/></svg>`,
	hand: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 2v6M11.5 3v5M14 5.5V8.5a5.5 5.5 0 01-11 0V5a1.5 1.5 0 013 0v3"/></svg>`,

	// ── History (U-shape curved arrows) ────────────────────────────────────
	undo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4H9.5a4.5 4.5 0 0 1 0 9H5"/><polyline points="8,1.5 5,4 8,6.5"/></svg>`,
	redo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6.5a4.5 4.5 0 0 0 0 9H11"/><polyline points="8,1.5 11,4 8,6.5"/></svg>`,

	// ── Edit actions ────────────────────────────────────────────────────────
	trash: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="4" x2="13" y2="4"/><path d="M5.5 4V2.5h5V4M5 4l.5 9.5h5.1L11 4"/><line x1="6.5" y1="7" x2="6.5" y2="11.5"/><line x1="9.5" y1="7" x2="9.5" y2="11.5"/></svg>`,
	duplicate: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M4 10.5V3.5A1.5 1.5 0 0 1 5.5 2H12"/></svg>`,
	dots: `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>`,
	arrow: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="11" y2="8"/><polyline points="8,5 12,8 8,11"/></svg>`,
	labelPos: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M8 4v7"/><line x1="2" y1="13" x2="14" y2="13" stroke-dasharray="2 2"/></svg>`,
	zoomIn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
	zoomOut: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>`,

	// ── Space tool (two vertical bars with outward arrows) ─────────────────
	space: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="2.5" height="8" rx="0.8"/><rect x="12.5" y="4" width="2.5" height="8" rx="0.8"/><path d="M4 8h8"/><path d="M5.5 6.5 4 8 5.5 9.5"/><path d="M10.5 6.5 12 8 10.5 9.5"/></svg>`,

	// ── BPMN Events (circles: thin=start, thick=end, double-ring=intermediate) ─
	startEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/></svg>`,
	endEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/></svg>`,
	intermediateThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/></svg>`,
	intermediateCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/></svg>`,

	// ── BPMN Activities (rounded rect + type marker top-left) ──────────────
	task: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/></svg>`,
	manualTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><path d="M3 9V6.5a1 1 0 012 0V9M5 8V5a1 1 0 012 0v3M7 7a1 1 0 012 0v1M9 8a1 1 0 012 0v1c0 2-1.5 3-4 3H5c-2 0-3.5-1-3.5-3V9" stroke-linecap="round"/></svg>`,
	callActivity: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2" stroke-width="2.5"/><path d="M6 8h4M8 6v4" stroke-linecap="round"/></svg>`,
	subProcess: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="5.5" y="9.5" width="5" height="4" rx="0.5"/><path d="M8 10.5v2M7 11.5h2" stroke-linecap="round"/></svg>`,
	adHocSubProcess: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><path d="M5 11Q6 9 8 11Q10 13 11 11" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	transaction: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="2" y="4" width="12" height="8" rx="1.5"/></svg>`,
	serviceTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="6" r="2.2" stroke-width="1.1"/><circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none"/><path d="M4 3.5v1M4 7.5v1M1.5 6h1M5.5 6h1" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	userTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="5.5" r="1.5" stroke-width="1.1"/><path d="M1 10Q1 7.5 4 7.5Q7 7.5 7 10" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	scriptTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="4.5" height="6" rx="0.5" stroke-width="1.1"/><path d="M2 5h2.5M2 6.5h2.5M2 8h1.5" stroke-linecap="round" stroke-width="1"/></svg>`,
	sendTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" fill="currentColor" rx="0.3" stroke-width="1.1"/></svg>`,
	receiveTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" rx="0.3" stroke-width="1.1"/><path d="M1 3.5l2.75 2 2.75-2" stroke-width="1.1"/></svg>`,
	businessRuleTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="6" height="4.5" stroke-width="1.1"/><path d="M1 5.3h6M3 3.5v4.5" stroke-width="1.1"/></svg>`,

	// ── BPMN Gateways (diamond + type marker) ──────────────────────────────
	exclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	parallelGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M8 4.5v7M4.5 8h7" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	inclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3" stroke-width="1.5"/></svg>`,
	eventBasedGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3.5" stroke-width="1"/><circle cx="8" cy="8" r="2" stroke-width="1"/></svg>`,
	complexGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M8 5v6M5 8h6M5.5 5.5l5 5M10.5 5.5l-5 5" stroke-linecap="round" stroke-width="1.5"/></svg>`,

	// ── Navigation ─────────────────────────────────────────────────────────
	openProcess: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h4v4M13 3l-6 6"/><path d="M7 5H3v8h8V9"/></svg>`,

	// ── BPMN Annotation ────────────────────────────────────────────────────
	textAnnotation: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 3L3 3L3 13L6 13"/><line x1="7" y1="6" x2="13" y2="6"/><line x1="7" y1="9" x2="12" y2="9"/><line x1="7" y1="12" x2="10" y2="12"/></svg>`,

	// ── BPMN Start Event variants ───────────────────────────────────────────
	messageStartEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><rect x="5" y="6" width="6" height="4" fill="currentColor" stroke="none"/><path d="M5 6l3 2.5L11 6" stroke="white" stroke-width="1" fill="none"/></svg>`,
	timerStartEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="3.5" stroke-width="1"/><path d="M8 5.5V8l1.5 1.5" stroke-linecap="round" stroke-width="1"/></svg>`,
	conditionalStartEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><rect x="5.5" y="5.5" width="5" height="5" stroke-width="1"/><line x1="6.5" y1="7" x2="9.5" y2="7" stroke-width="1"/><line x1="6.5" y1="8.5" x2="9.5" y2="8.5" stroke-width="1"/><line x1="6.5" y1="10" x2="8.5" y2="10" stroke-width="1"/></svg>`,
	signalStartEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><polygon points="8,5 11.5,11 4.5,11" fill="currentColor" stroke="none"/></svg>`,

	// ── BPMN End Event variants ─────────────────────────────────────────────
	messageEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><rect x="5" y="6" width="6" height="4" fill="currentColor" stroke="none"/><path d="M5 6l3 2.5L11 6" stroke="white" stroke-width="1" fill="none"/></svg>`,
	escalationEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><polygon points="8,5 10.5,11 8,9.5 5.5,11" fill="currentColor" stroke="none"/></svg>`,
	errorEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><path d="M9.5 5.5l-3.5 4h2.5L5 11.5l3.5-4H6z" fill="currentColor" stroke="none"/></svg>`,
	compensationEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><polygon points="8,6 5,8 8,10" fill="currentColor" stroke="none"/><polygon points="11,6 8,8 11,10" fill="currentColor" stroke="none"/></svg>`,
	signalEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><polygon points="8,5 11.5,11 4.5,11" fill="currentColor" stroke="none"/></svg>`,
	terminateEndEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/></svg>`,

	// ── BPMN Intermediate Event variants ────────────────────────────────────
	messageCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><rect x="5" y="6" width="6" height="4" stroke-width="1"/><path d="M5 6l3 2.5L11 6" stroke-width="1"/></svg>`,
	messageThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><rect x="5" y="6" width="6" height="4" fill="currentColor" stroke="none"/><path d="M5 6l3 2.5L11 6" stroke="white" stroke-width="1" fill="none"/></svg>`,
	timerCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="3" stroke-width="1"/><path d="M8 6V8l1.5 1.5" stroke-linecap="round" stroke-width="1"/></svg>`,
	escalationThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="8,5 10.5,11 8,9.5 5.5,11" fill="currentColor" stroke="none"/></svg>`,
	conditionalCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><rect x="5.5" y="5.5" width="5" height="5" stroke-width="1"/><line x1="6.5" y1="7" x2="9.5" y2="7" stroke-width="1"/><line x1="6.5" y1="8.5" x2="9.5" y2="8.5" stroke-width="1"/><line x1="6.5" y1="10" x2="8.5" y2="10" stroke-width="1"/></svg>`,
	linkCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="7,5.5 11,8 7,10.5 7,9 5,9 5,7 7,7" stroke-width="1"/></svg>`,
	linkThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="7,5.5 11,8 7,10.5 7,9 5,9 5,7 7,7" fill="currentColor" stroke="none"/></svg>`,
	compensationThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="8,6 5,8 8,10" fill="currentColor" stroke="none"/><polygon points="11,6 8,8 11,10" fill="currentColor" stroke="none"/></svg>`,
	signalCatchEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="8,5 11.5,11 4.5,11" stroke-width="1"/></svg>`,
	signalThrowEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4.5"/><polygon points="8,5 11.5,11 4.5,11" fill="currentColor" stroke="none"/></svg>`,

	// ── AI / assistant ──────────────────────────────────────────────────
	sparkle: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L9.1 5.9 13 7l-3.9 1.1L8 12 6.9 8.1 3 7l3.9-1.1L8 2z"/><circle cx="12.5" cy="3" r="1" opacity="0.5"/><circle cx="3.5" cy="12.5" r="0.75" opacity="0.4"/></svg>`,
};
