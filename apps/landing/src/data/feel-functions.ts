// Generated from the real @bpmnkit/feel builtin registry (packages/feel/src/builtins.ts,
// builtinNames()) — every function listed here is implemented and callable.

export interface FeelFunctionDoc {
	name: string
	description: string
	example?: string
}

export interface FeelFunctionCategory {
	id: string
	title: string
	functions: FeelFunctionDoc[]
}

export const FEEL_CATEGORIES: FeelFunctionCategory[] = [
	{
		id: "conversion",
		title: "Conversion",
		functions: [
			{
				name: "date",
				description: "Parses a string, or year/month/day numbers, into a FEEL date.",
				example: `date("2026-07-07")`,
			},
			{
				name: "date and time",
				description:
					"Combines a date and a time (or parses an ISO date-time string) into a date-time value.",
			},
			{
				name: "time",
				description: "Parses a string, or hour/minute/second numbers, into a FEEL time.",
				example: `time("14:30:00")`,
			},
			{
				name: "number",
				description: "Parses a string into a number, with an optional decimal separator argument.",
			},
			{ name: "string", description: "Converts any value to its string representation." },
			{
				name: "duration",
				description: "Parses an ISO 8601 duration string into a day-time or years-months duration.",
			},
			{
				name: "years and months duration",
				description: "Computes the years/months duration between two dates.",
			},
			{ name: "context", description: "Builds a context from a list of `{key, value}` entries." },
		],
	},
	{
		id: "boolean",
		title: "Boolean & type checks",
		functions: [
			{ name: "not", description: "Logical negation of a boolean." },
			{
				name: "is defined",
				description:
					"True if the given value is not null/undefined — the standard way to guard optional variables.",
			},
		],
	},
	{
		id: "string",
		title: "String",
		functions: [
			{
				name: "substring",
				description: "Returns a substring starting at a 1-based position, with an optional length.",
				example: `substring("BPMN Kit", 1, 4) = "BPMN"`,
			},
			{ name: "string length", description: "Number of characters in a string." },
			{ name: "upper case", description: "Converts a string to upper case." },
			{ name: "lower case", description: "Converts a string to lower case." },
			{
				name: "substring before",
				description: "Returns the part of a string before the first occurrence of a match.",
			},
			{
				name: "substring after",
				description: "Returns the part of a string after the first occurrence of a match.",
			},
			{
				name: "replace",
				description:
					"Regular-expression replace, following the XQuery/XPath `fn:replace` semantics.",
			},
			{ name: "contains", description: "True if a string contains a given substring." },
			{ name: "starts with", description: "True if a string starts with a given prefix." },
			{ name: "ends with", description: "True if a string ends with a given suffix." },
			{ name: "matches", description: "True if a string matches a regular expression." },
			{
				name: "split",
				description: "Splits a string on a regular-expression delimiter into a list of strings.",
			},
			{ name: "string join", description: "Joins a list of strings with an optional delimiter." },
		],
	},
	{
		id: "list",
		title: "List",
		functions: [
			{ name: "list contains", description: "True if a list contains a given element." },
			{ name: "count", description: "Number of elements in a list." },
			{ name: "min", description: "Smallest value in a list of comparable values." },
			{ name: "max", description: "Largest value in a list of comparable values." },
			{ name: "sum", description: "Sum of a list of numbers." },
			{ name: "mean", description: "Arithmetic mean (average) of a list of numbers." },
			{ name: "median", description: "Median of a list of numbers." },
			{ name: "stddev", description: "Sample standard deviation of a list of numbers." },
			{ name: "mode", description: "Most frequently occurring value(s) in a list." },
			{ name: "product", description: "Product of a list of numbers." },
			{ name: "all", description: "True if every element of a boolean list is true." },
			{ name: "any", description: "True if at least one element of a boolean list is true." },
			{ name: "sublist", description: "Returns a slice of a list starting at a 1-based position." },
			{ name: "append", description: "Appends one or more elements to the end of a list." },
			{ name: "concatenate", description: "Concatenates two or more lists into one." },
			{
				name: "insert before",
				description: "Inserts an element into a list at a given 1-based position.",
			},
			{
				name: "remove",
				description: "Returns a list with the element at a given position removed.",
			},
			{ name: "reverse", description: "Reverses the order of a list." },
			{
				name: "index of",
				description: "Returns the 1-based positions where a value occurs in a list.",
			},
			{ name: "union", description: "Union of two or more lists, removing duplicates." },
			{
				name: "distinct values",
				description: "Removes duplicate elements from a list, preserving order.",
			},
			{ name: "flatten", description: "Flattens nested lists into a single flat list." },
			{ name: "sort", description: "Sorts a list, optionally with a custom comparator function." },
		],
	},
	{
		id: "numeric",
		title: "Numeric",
		functions: [
			{ name: "decimal", description: "Rounds a number to a given number of decimal places." },
			{ name: "floor", description: "Rounds a number down to the nearest integer." },
			{ name: "ceiling", description: "Rounds a number up to the nearest integer." },
			{ name: "round up", description: "Rounds away from zero to a given precision." },
			{ name: "round down", description: "Rounds toward zero to a given precision." },
			{
				name: "round half up",
				description: "Rounds to nearest, ties away from zero, to a given precision.",
			},
			{
				name: "round half down",
				description: "Rounds to nearest, ties toward zero, to a given precision.",
			},
			{ name: "abs", description: "Absolute value of a number." },
			{ name: "modulo", description: "Remainder of dividing one number by another." },
			{ name: "sqrt", description: "Square root of a number." },
			{ name: "log", description: "Natural logarithm of a number." },
			{ name: "exp", description: "Euler's number e raised to the given power." },
			{ name: "odd", description: "True if an integer is odd." },
			{ name: "even", description: "True if an integer is even." },
			{ name: "random number", description: "Returns a random number in the range [0, 1)." },
		],
	},
	{
		id: "datetime-parts",
		title: "Date & time components",
		functions: [
			{ name: "today", description: "The current date." },
			{ name: "now", description: "The current date-time." },
			{ name: "day of week", description: "Name of the weekday for a given date." },
			{ name: "day of year", description: "Ordinal day of the year (1–366) for a given date." },
			{ name: "month of year", description: "Name of the month for a given date." },
			{ name: "week of year", description: "ISO week number for a given date." },
			{
				name: "last day of month",
				description: "The last day of the month containing a given date.",
			},
		],
	},
	{
		id: "interval",
		title: "Range & interval (Allen's interval algebra)",
		functions: [
			{ name: "before", description: "True if one value/range ends before another starts." },
			{ name: "after", description: "True if one value/range starts after another ends." },
			{ name: "meets", description: "True if one range ends exactly where another begins." },
			{ name: "met by", description: "True if one range begins exactly where another ends." },
			{ name: "overlaps", description: "True if two ranges overlap." },
			{
				name: "overlaps before",
				description: "True if a range starts before, and overlaps the start of, another.",
			},
			{
				name: "overlaps after",
				description: "True if a range ends after, and overlaps the end of, another.",
			},
			{
				name: "finishes",
				description: "True if a range ends at the same point as another, starting later.",
			},
			{
				name: "finished by",
				description: "True if a range ends at the same point as another, starting earlier.",
			},
			{ name: "includes", description: "True if a range fully contains another range or value." },
			{
				name: "during",
				description: "True if a value or range falls entirely within another range.",
			},
			{
				name: "starts",
				description: "True if a range starts at the same point as another, ending earlier.",
			},
			{
				name: "started by",
				description: "True if a range starts at the same point as another, ending later.",
			},
			{ name: "coincides", description: "True if two ranges (or values) are exactly equal." },
		],
	},
	{
		id: "context",
		title: "Context",
		functions: [
			{
				name: "context merge",
				description: "Merges a list of contexts into one, later keys overriding earlier ones.",
			},
			{
				name: "context put",
				description: "Returns a new context with a key set to a given value.",
			},
			{ name: "get entries", description: "Returns a context's `{key, value}` pairs as a list." },
			{ name: "get value", description: "Looks up a value in a context by key." },
			{ name: "get or else", description: "Returns a value, or a fallback if the value is null." },
		],
	},
]

export const FEEL_FUNCTION_COUNT = FEEL_CATEGORIES.reduce((n, c) => n + c.functions.length, 0)
