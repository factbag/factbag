/**
 * Entry point for the demo: load the API key, then either offer the scenario menu or
 * run the scenario named on the command line.
 *
 * Usage: pnpm --filter @factbag/jev-examples demo [j1 [case] | ofac]
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Box, render } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { Demo, showcase } from "./demo";
import { Picker } from "./picker";
import type { Showcase } from "./demo";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
if ((process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  process.stderr.write("Set TYPESAFE_API_KEY in your shell or the repo's .env to run the demo.\n");
  process.exitCode = 1;
} else {
  const argv = process.argv.slice(2);
  // With no scenario named, and a terminal to read keys from, offer the menu.
  const { waitUntilExit } = render(
    argv.length === 0 && process.stdin.isTTY ? <App /> : <Demo showcase={showcase(argv)} />,
  );
  await waitUntilExit();
}

/** Menu, run, then the menu again, so several scenarios can be tried in one sitting. */
function App(): ReactElement {
  const [chosen, setChosen] = useState<{ showcase: Showcase; run: number } | undefined>(undefined);
  const [finished, setFinished] = useState(false);
  const choose = (argv: readonly string[]): void => {
    setFinished(false);
    setChosen((current) => ({ showcase: showcase(argv), run: (current?.run ?? 0) + 1 }));
  };
  if (chosen === undefined) {
    return <Picker onChoose={choose} />;
  }
  return (
    <Box flexDirection="column">
      <Demo
        key={chosen.run}
        showcase={chosen.showcase}
        onFinished={() => {
          setFinished(true);
        }}
      />
      {finished ? <Picker onChoose={choose} title="Run another" /> : null}
    </Box>
  );
}
