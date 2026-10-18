import "./base.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Check from both the application and the installed package. A transitive or
// auto-installed peer must not silently satisfy the SDK-free consumer test.
for (const location of [import.meta.url, import.meta.resolve("factbag/kb")]) {
  const require = createRequire(location);
  assert.throws(() => require.resolve("@typesafe-ai/sdk"), { code: "MODULE_NOT_FOUND" });
}
