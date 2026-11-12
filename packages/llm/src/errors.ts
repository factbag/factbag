/**
 * A tool call the model can fix: an unknown tool, or arguments that do not match the
 * tool's schema or the knowledge base. Its message is written for the model, so
 * return it as the tool's result and let the model try again. Any other error from
 * {@link Toolkit.call} is a bug or a broken knowledge base, not the model's mistake.
 *
 * @beta
 */
export class CorrectableToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrectableToolError";
  }
}
