/** Represents an XML element with preserved namespace prefixes for roundtrip fidelity. */
export interface XmlElement {
	/** Qualified element name, e.g. "custom:myExtension" */
	name: string;
	/** Attribute keys retain namespace prefix (e.g. "xsi:type"), values are strings */
	attributes: Record<string, string>;
	/** Nested child elements */
	children: XmlElement[];
	/** Text content, if any */
	text?: string;
}
