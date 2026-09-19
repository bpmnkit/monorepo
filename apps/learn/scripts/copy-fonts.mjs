// Copies the design-system webfonts (Space Grotesk + Space Mono, both OFL 1.1)
// out of the landing app into public/fonts/, licences included, so Learn serves
// its own faces instead of depending on bpmnkit.com's routes. Runs before dev
// and build; see src/styles/fonts.css for the @font-face declarations.
import { cp } from "node:fs/promises"

await cp("../landing/public/fonts", "public/fonts", { recursive: true })
console.log("fonts copied to public/fonts/")
