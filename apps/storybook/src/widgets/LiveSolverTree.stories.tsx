import type { Meta, StoryObj } from "@storybook/react-vite";

import { LiveSolverTree } from "@factbag/widgets";

const meta: Meta<typeof LiveSolverTree> = {
  title: "Widgets/Live solver/Live Solver Tree",
  component: LiveSolverTree,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
