import type { Meta, StoryObj } from "@storybook/react-vite";

import { EvaluationGraph } from "@factbag/widgets";

const meta: Meta<typeof EvaluationGraph> = {
  title: "Widgets/Formal model/Evaluation Graph",
  component: EvaluationGraph,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
