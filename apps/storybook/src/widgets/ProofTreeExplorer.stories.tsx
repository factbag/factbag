import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProofTreeExplorer } from "@factbag/widgets";

const meta: Meta<typeof ProofTreeExplorer> = {
  title: "Widgets/Live solver/Proof Tree Explorer",
  component: ProofTreeExplorer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
