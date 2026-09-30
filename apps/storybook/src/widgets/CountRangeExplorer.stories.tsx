import type { Meta, StoryObj } from "@storybook/react-vite";

import { CountRangeExplorer } from "@factbag/widgets";

const meta: Meta<typeof CountRangeExplorer> = {
  title: "Widgets/Scenarios/Count Range Explorer",
  component: CountRangeExplorer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
