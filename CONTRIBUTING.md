# Contributing

## Package README

Edit the root `README.md`; the package build copies it to
`packages/factbag/README.md` for npm. Use absolute links and image URLs so they
work in both locations. Run `pnpm build` and commit the generated copy.

## Pull request titles

Use a [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
title. If the change has an associated ticket, append its ID in parentheses:

```text
<type>[optional scope]: <description> (TICKET-ID)
```

Omit the ticket suffix when there is no associated ticket. The scope is optional.
Use a type that describes the change, such as `feat`, `fix`, `docs`, `refactor`,
`test`, `ci`, or `chore`.

Examples:

- With a ticket: `fix(corpus): preserve evidence sources (FAC-123)`
- Without a ticket: `fix(corpus): preserve evidence sources`
- Without a scope: `docs: clarify installation requirements`
