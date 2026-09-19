/** Mark for a profile tag. Predefined: dev / stage / prod. */
export function ProfileTag({ tag }: { tag: string }) {
	const tone =
		tag === "prod"
			? "ds-mark--danger"
			: tag === "stage"
				? "ds-mark--warn"
				: tag === "dev"
					? "ds-mark--success"
					: ""
	return <span className={`ds-mark ${tone}`}>{tag}</span>
}
