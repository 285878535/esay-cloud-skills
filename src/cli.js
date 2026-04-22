#!/usr/bin/env node

import { run } from "./main.js";

const argv = process.argv.slice(2);
const json = argv.includes("--json");

run(argv).catch((error) => {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: error.message }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exitCode = 1;
});
