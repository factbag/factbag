import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProofTreeExplorer, WidgetChrome } from "@factbag/widgets";

/** Hosts choose the framing: the default card, or plain flow for prose that
 * already frames the widget (a docs section, a blog post). */
const meta: Meta<typeof WidgetChrome> = {
  title: "Widgets/Widget Chrome",
  component: WidgetChrome,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {
  render: () => (
    <WidgetChrome variant="card">
      <ProofTreeExplorer />
    </WidgetChrome>
  ),
};

export const Plain: Story = {
  render: () => (
    <WidgetChrome variant="plain">
      <ProofTreeExplorer />
    </WidgetChrome>
  ),
};
