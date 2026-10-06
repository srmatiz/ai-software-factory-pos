// Expected business-rule failures. Server actions turn these into form
// errors; anything else is an unexpected bug and is rethrown.
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
