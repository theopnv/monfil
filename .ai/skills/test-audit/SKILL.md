---
name: test-audit
description: Invoke whenever writing, changing, reviewing, or pruning tests.
---

Before adding or changing a test, answer:
1. What observable behavior does it protect?
2. What credible regression makes it fail?
3. Why doesn't existing coverage catch that?
4. Does it need a production seam no production caller uses?
If any answer is missing, do not add the test.

Reject:
Tautological tests that verify the testing framework or mock objects instead of application code.
Over-mocking, where dependencies are stubbed so heavily the test runs in a vacuum.
Happy-path-only coverage that avoids critical error boundaries entirely.
Copied assertions, where the test blindly asserts whatever wrong value the function currently returns.Assertion-free tests, self-comparisons, expected values
computed by the code under test, mocks that implement the asserted
behavior, string greps of source, tests that break on behavior-
preserving refactors.

Keep: public API, protocol, config, migration, security, release
contracts. Slow or static is not a reason to delete.

