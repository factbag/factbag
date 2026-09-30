import type { Meta, StoryObj } from "@storybook/react-vite";

import { TrialEligibilityTree } from "@factbag/widgets";

const meta: Meta<typeof TrialEligibilityTree> = {
  title: "Widgets/Scenarios/Trial Eligibility Tree",
  component: TrialEligibilityTree,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
