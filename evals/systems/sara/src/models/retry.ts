/** Attempts per request when a model endpoint answers 429, such as "Capacity temporarily exceeded". */
const ATTEMPTS = 5;
/** The wait before the first retry, doubled for each later one. */
const FIRST_RETRY_MS = 1000;

/**
 * Send until the answer is not a 429, or the attempts run out: after 1, 2, 4 and 8
 * seconds, or after the `retry-after` the response gives. The last answer is returned
 * whatever its status.
 */
export async function retrying(send: () => Promise<Response>): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each retry waits on the previous answer.
    const response = await send();
    if (response.status !== 429 || attempt === ATTEMPTS) {
      return response;
    }
    const after = Number(response.headers.get("retry-after"));
    const waitMs = after > 0 ? after * 1000 : FIRST_RETRY_MS * 2 ** (attempt - 1);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Backing off before the next attempt.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }
}
