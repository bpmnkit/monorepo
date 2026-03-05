#!/usr/bin/env node
import { run } from "./run.js";

await run(process.argv.slice(2));
