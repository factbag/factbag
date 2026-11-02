/** A JSON value, as System One requests carry state and question wording. @beta */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A typed System One question. Only the types Factbag asks are listed. @beta */
export type Question =
  | {
      readonly type: "noul";
      readonly instructions: { [key: string]: JsonValue };
      readonly criteria: { readonly true: string; readonly false: string };
    }
  | {
      readonly type: "choice";
      readonly instructions: { [key: string]: JsonValue };
      readonly criteria: Readonly<Record<string, string>>;
    };

/** State and keyed questions, as every System One API accepts them. @beta */
export type SystemOneRequest = {
  readonly state: { [key: string]: JsonValue };
  readonly questions: Readonly<Record<string, Question>>;
};

/** Answers keyed like the request's questions. They are validated after the transport returns. @beta */
export type SystemOneResponse = {
  readonly answers: unknown;
};

/** Sends one request to a model and returns its answers. Retries and timeouts belong here. @beta */
export type Transport = (request: SystemOneRequest) => Promise<SystemOneResponse>;

/**
 * A System One model behind a vendor's API. Everything Factbag asks, and how it reads the
 * answers, is shared; a provider supplies only how to reach the model and how much one
 * request may hold.
 *
 * @beta
 */
export type Provider<Options extends object> = {
  /** Namespace for the model's details in evidence annotations. */
  readonly name: string;
  /**
   * The most questions one request may hold, enforced before anything is sent. Use
   * `Infinity` when only the context window limits a request.
   */
  readonly maxBatchSize: number;
  /** Questions per request when the caller does not choose; at most `maxBatchSize`. */
  readonly defaultBatchSize: number;
  /**
   * Build a transport from the caller's options. Called once per configuration, on its first
   * request, so building a run never reads credentials or constructs a client.
   */
  readonly connect: (options: Partial<Options>) => Transport;
};
