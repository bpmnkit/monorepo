/**
 * Syntax colours for Markdown code blocks (docs and blog).
 *
 * The same ink palette the hand-written code panels use — see the `--code-*`
 * tokens in `src/styles/global.css`. Keeping the two in step is what makes a
 * generated docs page and a hand-built landing section look like one site.
 */

const BG = "#14161a"
const FG = "#e6e8ec"
const KEYWORD = "#7f8794"
const STRING = "#9fb8a4"
const CALL = "#d99a7c"
const COMMENT = "#6b7280"
const PUNCTUATION = "#9aa2ae"

/** @type {import("astro").ShikiConfig["theme"]} */
export const inkTheme = {
	name: "bpmnkit-ink",
	type: "dark",
	colors: {
		"editor.background": BG,
		"editor.foreground": FG,
	},
	settings: [
		{ settings: { background: BG, foreground: FG } },
		{
			scope: ["comment", "punctuation.definition.comment"],
			settings: { foreground: COMMENT, fontStyle: "italic" },
		},
		{
			scope: ["string", "punctuation.definition.string", "constant.other.symbol"],
			settings: { foreground: STRING },
		},
		{
			scope: ["constant.numeric", "constant.language", "constant.character.escape"],
			settings: { foreground: CALL },
		},
		{
			scope: [
				"keyword",
				"keyword.control",
				"keyword.operator.new",
				"keyword.operator.expression",
				"storage",
				"storage.type",
				"storage.modifier",
				"variable.language",
				"entity.name.tag",
			],
			settings: { foreground: KEYWORD },
		},
		{
			scope: ["entity.name.function", "support.function", "meta.function-call", "markup.heading"],
			settings: { foreground: CALL },
		},
		{
			scope: ["entity.other.attribute-name", "support.type.property-name"],
			settings: { foreground: STRING },
		},
		{
			scope: [
				"entity.name.type",
				"entity.name.class",
				"support.class",
				"support.type",
				"variable",
				"variable.other",
				"meta.object-literal.key",
			],
			settings: { foreground: FG },
		},
		{
			scope: ["punctuation", "meta.brace", "keyword.operator"],
			settings: { foreground: PUNCTUATION },
		},
	],
}
