export const BIOC_NS = "http://bpmn.io/schema/bpmn/biocolor/1.0";
export const COLOR_NS = "http://www.omg.org/spec/BPMN/non-normative/color/1.0";

export interface DiColor {
	fill?: string;
	stroke?: string;
}

export function readDiColor(attrs: Record<string, string>): DiColor {
	return {
		fill: attrs["bioc:fill"] ?? attrs["color:background-color"] ?? undefined,
		stroke: attrs["bioc:stroke"] ?? attrs["color:border-color"] ?? undefined,
	};
}

export function writeDiColor(
	attrs: Record<string, string>,
	color: DiColor,
): Record<string, string> {
	// Build a new object, omitting existing color keys, then add new ones if set
	const r: Record<string, string> = {};
	const colorKeys = new Set([
		"bioc:fill",
		"color:background-color",
		"bioc:stroke",
		"color:border-color",
	]);
	for (const [k, v] of Object.entries(attrs)) {
		if (!colorKeys.has(k)) r[k] = v;
	}
	if (color.fill) {
		r["bioc:fill"] = color.fill;
		r["color:background-color"] = color.fill;
	}
	if (color.stroke) {
		r["bioc:stroke"] = color.stroke;
		r["color:border-color"] = color.stroke;
	}
	return r;
}
