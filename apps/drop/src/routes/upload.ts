import type { Env } from "../env.js"
import { findBannedHashes, insertDrop } from "../lib/db.js"
import { json } from "../lib/http.js"
import { newFileId, newShareId, sha256Hex } from "../lib/ids.js"
import { type ValidatedFile, ValidationError, validateFile } from "../lib/validate.js"
import { MAX_DROP_BYTES, MAX_FILES_PER_DROP } from "../shared/constants.js"

type PreparedFile = ValidatedFile & { id: string; hash: string }

/** Append " (n)" before the extension to keep filenames unique within a drop. */
function dedupeName(name: string, n: number): string {
	const dot = name.lastIndexOf(".")
	if (dot <= 0) return `${name} (${n})`
	return `${name.slice(0, dot)} (${n})${name.slice(dot)}`
}

/** POST /drop/api/drops — validate, convert, and atomically store a multi-file drop. */
export async function handleUpload(request: Request, env: Env, now: number): Promise<Response> {
	let form: FormData
	try {
		form = await request.formData()
	} catch {
		return json({ error: "expected multipart/form-data with a 'files' field" }, { status: 400 })
	}

	const uploads = form.getAll("files").filter((e): e is File => e instanceof File)
	if (uploads.length === 0) return json({ error: "no files provided" }, { status: 400 })
	if (uploads.length > MAX_FILES_PER_DROP) {
		return json({ error: `too many files (max ${MAX_FILES_PER_DROP})` }, { status: 413 })
	}

	const prepared: PreparedFile[] = []
	const errors: string[] = []
	const usedNames = new Set<string>()
	let total = 0

	for (const upload of uploads) {
		let text: string
		try {
			text = await upload.text()
		} catch {
			errors.push(`${upload.name}: could not read file`)
			continue
		}

		try {
			const v = validateFile(upload.name, text)
			let filename = v.filename
			for (let n = 2; usedNames.has(filename); n++) filename = dedupeName(v.filename, n)
			usedNames.add(filename)
			total += v.sizeOriginal
			prepared.push({ ...v, filename, id: newFileId(), hash: await sha256Hex(text) })
		} catch (err) {
			errors.push(
				err instanceof ValidationError ? err.message : `${upload.name}: could not process`,
			)
		}
	}

	if (errors.length > 0) {
		return json({ error: "some files were rejected", details: errors }, { status: 400 })
	}
	if (total > MAX_DROP_BYTES) {
		return json({ error: "drop exceeds the total size limit" }, { status: 413 })
	}

	const banned = await findBannedHashes(
		env.DB,
		prepared.map((f) => f.hash),
	)
	if (banned.length > 0) {
		return json({ error: "this content is not allowed" }, { status: 422 })
	}

	const shareId = newShareId()
	await insertDrop(env.DB, { shareId, files: prepared, tosVersion: env.TOS_VERSION, now })

	return json(
		{
			shareId,
			url: `/drop/${shareId}`,
			files: prepared.map((f) => ({ filename: f.filename, kind: f.kind, name: f.name })),
		},
		{ status: 201 },
	)
}
