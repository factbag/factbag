import type { Entity } from "../../src/dsl/types";

export class Person implements Entity {
  constructor(readonly id: string) {}
}

export const alice: Person = new Person("alice");
