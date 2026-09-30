import type { Meta, StoryObj } from "@storybook/react-vite";

import { LiveSolverExplorer } from "@factbag/widgets";

const meta: Meta<typeof LiveSolverExplorer> = {
  title: "Widgets/Live solver/Live Solver Explorer",
  component: LiveSolverExplorer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
