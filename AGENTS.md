# Code Style

- All files should be named using kebab-case (e.g., `coding-agent.ts`, `home-page.tsx`),
  not CamelCase or PascalCase.

# Documentation Best Practices

- All comments should be written in complete sentences and terminated with a punctuation
  mark. Focus on _why_ the code exists, don't just narrate what it does.
- Use `//` line comments above non-trivial code blocks within function bodies. Use
  multi-line `/** ... */` doc comments above all functions. Doc comment format looks like:
  ```ts
  /**
   * Look up an agent by name.
   */
  ```
- All comments should be wrapped to fit in the 90-character line width.
- When the user repeats the same guidance or correction pattern, suggest a concise
  documentation update to capture it as a repository best practice.
- Prefer updating agent-facing guidance (`AGENTS.md`) for workflow expectations and
  developer-facing docs for project usage details.

# Workflow

- After editing code, run `make check-and-fix`.
