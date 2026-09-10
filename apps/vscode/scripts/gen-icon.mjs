// Renders the Marketplace icon from the site's favicon, so the extension's
// listing cannot drift from the brand it is listing. Output is deterministic,
// so re-running this leaves the working tree clean.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { Resvg } from "@resvg/resvg-js"

const svg = await readFile(new URL("../../landing/public/favicon.svg", import.meta.url), "utf8")
const png = new Resvg(svg, { fitTo: { mode: "width", value: 128 } }).render().asPng()

await mkdir(new URL("../media/", import.meta.url), { recursive: true })
await writeFile(new URL("../media/icon.png", import.meta.url), png)
