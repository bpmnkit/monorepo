// A minimal ZIP writer (STORE, no compression) — enough for an OOXML package.
// Timestamps are fixed so the same input always yields the same bytes.

const CRC_TABLE = (() => {
	const t = new Uint32Array(256)
	for (let i = 0; i < 256; i++) {
		let c = i
		for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
		t[i] = c
	}
	return t
})()

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff
	for (const byte of data) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0)
	return (crc ^ 0xffffffff) >>> 0
}

/** 1980-01-01 00:00, the earliest DOS date. Zero is not a valid date and some readers reject it. */
const DOS_DATE = 0x0021

export function zipStore(files: ReadonlyArray<{ name: string; data: Uint8Array }>): Uint8Array {
	const enc = new TextEncoder()
	const parts: Uint8Array[] = []
	const central: Uint8Array[] = []
	let offset = 0
	let centralSize = 0

	for (const file of files) {
		const name = enc.encode(file.name)
		const crc = crc32(file.data)
		const size = file.data.length

		const local = new Uint8Array(30 + name.length)
		const lv = new DataView(local.buffer)
		lv.setUint32(0, 0x04034b50, true)
		lv.setUint16(4, 20, true)
		lv.setUint16(6, 0x0800, true) // UTF-8 names
		lv.setUint16(12, DOS_DATE, true)
		lv.setUint32(14, crc, true)
		lv.setUint32(18, size, true)
		lv.setUint32(22, size, true)
		lv.setUint16(26, name.length, true)
		local.set(name, 30)
		parts.push(local, file.data)

		const cd = new Uint8Array(46 + name.length)
		const cv = new DataView(cd.buffer)
		cv.setUint32(0, 0x02014b50, true)
		cv.setUint16(4, 20, true)
		cv.setUint16(6, 20, true)
		cv.setUint16(8, 0x0800, true)
		cv.setUint16(14, DOS_DATE, true)
		cv.setUint32(16, crc, true)
		cv.setUint32(20, size, true)
		cv.setUint32(24, size, true)
		cv.setUint16(28, name.length, true)
		cv.setUint32(42, offset, true)
		cd.set(name, 46)
		central.push(cd)

		offset += local.length + size
		centralSize += cd.length
	}

	const eocd = new Uint8Array(22)
	const ev = new DataView(eocd.buffer)
	ev.setUint32(0, 0x06054b50, true)
	ev.setUint16(8, files.length, true)
	ev.setUint16(10, files.length, true)
	ev.setUint32(12, centralSize, true)
	ev.setUint32(16, offset, true)

	const out = new Uint8Array(offset + centralSize + eocd.length)
	let pos = 0
	for (const part of [...parts, ...central, eocd]) {
		out.set(part, pos)
		pos += part.length
	}
	return out
}
