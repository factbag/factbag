/** The scenario menu shown when the demo is started without arguments. */
import { Box, Text, useApp, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { width } from "./demo";

/** The scenarios the menu offers, in the order they are listed. */
const menu: readonly { readonly argv: readonly string[]; readonly detail: string }[] = [
  { argv: ["j1", "contradictory"], detail: "two emails disagree; nothing supersedes" },
  { argv: ["j1", "positive"], detail: "one email establishes the tenure track" },
  { argv: ["j1", "negative"], detail: "one email establishes a visiting appointment" },
  { argv: ["j1", "contradictory-document"], detail: "one thread contradicts itself" },
  { argv: ["j1", "neutral"], detail: "nothing on the question at all" },
  { argv: ["ofac"], detail: "ownership chain; stale records superseded" },
  { argv: ["haystack"], detail: "the same chain buried in 44 unrelated documents" },
];

export function Picker({
  onChoose,
  title = "Jev demo",
}: {
  onChoose: (argv: readonly string[]) => void;
  title?: string;
}): ReactElement {
  const { exit } = useApp();
  const [active, setActive] = useState(0);
  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setActive((current) => (current + menu.length - 1) % menu.length);
    } else if (key.downArrow || input === "j") {
      setActive((current) => (current + 1) % menu.length);
    } else if (key.return) {
      onChoose(menu[active]?.argv ?? ["j1"]);
    } else if (key.escape || input === "q") {
      exit();
    }
  });
  const labels = menu.map(({ argv }) => showcaseLabel(argv));
  const column = Math.max(...labels.map((label) => label.length)) + 2;
  return (
    <Box flexDirection="column" width={width}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Text bold>{title}</Text>
        <Text dimColor>↑↓ to move · enter to run · q to quit</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        {menu.map(({ argv, detail }, index) => (
          <Box key={argv.join(" ")} gap={1}>
            <Text color={index === active ? "cyan" : "gray"}>{index === active ? "❯" : " "}</Text>
            <Box width={column} flexShrink={0}>
              {index === active ? (
                <Text bold color="cyan">
                  {showcaseLabel(argv)}
                </Text>
              ) : (
                <Text>{showcaseLabel(argv)}</Text>
              )}
            </Box>
            <Text dimColor>{detail}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function showcaseLabel(argv: readonly string[]): string {
  return argv.join(" · ");
}
