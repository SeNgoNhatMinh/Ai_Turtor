# Flutter conventions
- Follow feature-first lib/features/<feature>/{data,application,presentation} where those layers already exist.
- Keep Riverpod 2 patterns and GoRouter. Do not introduce Bloc, GetX, get_it, injectable or a second DI stack.
- Keep IO in existing repositories/providers, not widget build methods.
- Keep dispose/onDispose, CancelToken, mounted checks and subscription lifecycles.
- Use const where appropriate, narrow provider watches, stable list keys and lazy builders.
- Do not perform blanket formatting of a dirty tree or hand-edit generated localizations.
- Prefer the existing shared widget public APIs over parallel component libraries.
