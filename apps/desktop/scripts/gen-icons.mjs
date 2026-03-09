#!/usr/bin/env node
/**
 * Generates minimal placeholder PNG icons for the Tauri desktop build.
 * Run: node scripts/gen-icons.mjs
 *
 * For a production app, replace with proper icons:
 *   pnpm tauri icon path/to/icon.png
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { deflateSync } from "node:zlib"

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
	let c = i
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	CRC_TABLE[i] = c
}

function crc32(buf) {
	let crc = 0xffffffff
	for (const byte of buf) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
	return (crc ^ 0xffffffff) >>> 0
}

// ── PNG chunk ─────────────────────────────────────────────────────────────────

function pngChunk(type, data) {
	const typeBytes = Buffer.from(type, "ascii")
	const len = Buffer.allocUnsafe(4)
	len.writeUInt32BE(data.length, 0)
	const crcBuf = Buffer.allocUnsafe(4)
	crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)
	return Buffer.concat([len, typeBytes, data, crcBuf])
}

// ── PNG builder (truecolor RGBA) ──────────────────────────────────────────────

function makePng(width, height, r, g, b) {
	const ihdr = Buffer.allocUnsafe(13)
	ihdr.writeUInt32BE(width, 0)
	ihdr.writeUInt32BE(height, 4)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // color type: truecolor + alpha (RGBA)
	ihdr[10] = 0 // compression method
	ihdr[11] = 0 // filter method
	ihdr[12] = 0 // interlace: none

	// Raw scanlines: filter byte (0 = None) + RGBA pixels
	const scanline = 1 + width * 4
	const raw = Buffer.allocUnsafe(height * scanline)
	for (let y = 0; y < height; y++) {
		const row = y * scanline
		raw[row] = 0
		for (let x = 0; x < width; x++) {
			const px = row + 1 + x * 4
			raw[px] = r
			raw[px + 1] = g
			raw[px + 2] = b
			raw[px + 3] = 255 // fully opaque
		}
	}

	const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
	return Buffer.concat([
		PNG_SIG,
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", deflateSync(raw)),
		pngChunk("IEND", Buffer.alloc(0)),
	])
}

// ── Generate ──────────────────────────────────────────────────────────────────

// BPMN SDK blue: #0062ff
const [R, G, B] = [0, 98, 255]
const iconsDir = new URL("../src-tauri/icons", import.meta.url).pathname
mkdirSync(iconsDir, { recursive: true })

for (const size of [32, 128, 256]) {
	const file = `${iconsDir}/${size}x${size}.png`
	writeFileSync(file, makePng(size, size, R, G, B))
	console.log(`  created ${size}x${size}.png`)
}

console.log("\nDone. Replace icons with proper artwork: pnpm tauri icon icon.png")
