import type { Meta, StoryObj } from "@storybook/react-vite";

import { EverydayDecision } from "@factbag/widgets";

const meta: Meta<typeof EverydayDecision> = {
  title: "Widgets/Scenarios/Everyday Decision",
  component: EverydayDecision,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
