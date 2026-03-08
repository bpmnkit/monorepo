import type { StorageApi } from "./storage-api.js";
import type { FileType } from "./types.js";

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
		}
		t[i] = c;
	}
	return t;
})();

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

// ─── ZIP builder (STORE — no compression) ────────────────────────────────────

interface ZipEntry {
	nameBytes: Uint8Array;
	data: Uint8Array;
	crc: number;
	offset: number;
}

function u16(view: DataView, off: number, v: number): void {
	view.setUint16(off, v, true);
}
function u32(view: DataView, off: number, v: number): void {
	view.setUint32(off, v, true);
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
	const enc = new TextEncoder();
	const entries: ZipEntry[] = [];
	const localParts: Uint8Array[] = [];
	let dataOffset = 0;

	for (const file of files) {
		const nameBytes = enc.encode(file.name);
		const crc = crc32(file.data);
		const headerLen = 30 + nameBytes.length;
		const header = new Uint8Array(headerLen);
		const v = new DataView(header.buffer);

		u32(v, 0, 0x04034b50); // local file signature
		u16(v, 4, 10); // version needed: 1.0
		u16(v, 6, 0); // flags
		u16(v, 8, 0); // STORE
		u16(v, 10, 0); // last mod time
		u16(v, 12, 0); // last mod date
		u32(v, 14, crc);
		u32(v, 18, file.data.length); // compressed size
		u32(v, 22, file.data.length); // uncompressed size
		u16(v, 26, nameBytes.length);
		u16(v, 28, 0); // extra field length
		header.set(nameBytes, 30);

		entries.push({ nameBytes, data: file.data, crc, offset: dataOffset });
		localParts.push(header, file.data);
		dataOffset += headerLen + file.data.length;
	}

	// Central directory
	const centralParts: Uint8Array[] = [];
	let centralSize = 0;
	for (const e of entries) {
		const len = 46 + e.nameBytes.length;
		const cd = new Uint8Array(len);
		const v = new DataView(cd.buffer);

		u32(v, 0, 0x02014b50); // central dir signature
		u16(v, 4, 20); // version made by
		u16(v, 6, 10); // version needed
		u16(v, 8, 0); // flags
		u16(v, 10, 0); // STORE
		u16(v, 12, 0); // last mod time
		u16(v, 14, 0); // last mod date
		u32(v, 16, e.crc);
		u32(v, 20, e.data.length); // compressed size
		u32(v, 24, e.data.length); // uncompressed size
		u16(v, 28, e.nameBytes.length);
		u16(v, 30, 0); // extra field length
		u16(v, 32, 0); // file comment length
		u16(v, 34, 0); // disk number start
		u16(v, 36, 0); // internal file attributes
		u32(v, 38, 0); // external file attributes
		u32(v, 42, e.offset); // relative offset of local header
		cd.set(e.nameBytes, 46);

		centralParts.push(cd);
		centralSize += len;
	}

	// End of central directory record
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	u32(ev, 0, 0x06054b50);
	u16(ev, 4, 0);
	u16(ev, 6, 0);
	u16(ev, 8, entries.length);
	u16(ev, 10, entries.length);
	u32(ev, 12, centralSize);
	u32(ev, 16, dataOffset);
	u16(ev, 20, 0);

	const totalSize = dataOffset + centralSize + 22;
	const out = new Uint8Array(totalSize);
	let pos = 0;
	for (const part of [...localParts, ...centralParts, eocd]) {
		out.set(part, pos);
		pos += part.length;
	}
	return out;
}

// ─── File extension helper ────────────────────────────────────────────────────

function fileExt(type: FileType): string {
	if (type === "bpmn") return ".bpmn";
	if (type === "dmn") return ".dmn";
	return ".form";
}

// ─── Public ───────────────────────────────────────────────────────────────────

export async function exportProjectAsZip(api: StorageApi): Promise<void> {
	const projectId = api.getCurrentProjectId();
	if (!projectId) return;

	const projectName = api.getProjectName(projectId) ?? "project";
	const files = await api.getFiles(projectId);
	const enc = new TextEncoder();
	const entries: Array<{ name: string; data: Uint8Array }> = [];

	for (const file of files) {
		const content = await api.getFileContent(file.id);
		if (content === null) continue;
		const suffix = fileExt(file.type);
		const filename = file.name.toLowerCase().endsWith(suffix) ? file.name : `${file.name}${suffix}`;
		entries.push({ name: filename, data: enc.encode(content) });
	}

	if (entries.length === 0) return;

	const zip = buildZip(entries);
	const blob = new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${projectName}.zip`;
	a.click();
	URL.revokeObjectURL(url);
}
