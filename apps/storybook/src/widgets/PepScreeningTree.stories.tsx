import type { Meta, StoryObj } from "@storybook/react-vite";

import { PepScreeningTree } from "@factbag/widgets";

const meta: Meta<typeof PepScreeningTree> = {
  title: "Widgets/Scenarios/PEP Screening Tree",
  component: PepScreeningTree,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
