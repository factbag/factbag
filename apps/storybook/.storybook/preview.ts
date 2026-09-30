import type { Preview } from "@storybook/react-vite";

import "./styles.css";

const preview: Preview = {
  parameters: {
    docs: {
      toc: true,
    },
    layout: "centered",
  },
};

export default preview;
