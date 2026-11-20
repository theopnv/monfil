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
- Tautological tests that verify the testing framework or mock objects instead of application code.
- Over-mocking, where dependencies are stubbed so heavily that the test runs in a vacuum.
- Happy-path-only coverage that avoids the critical error boundaries.
- Copied assertions, where the test asserts whatever wrong value the function returns now.
- Assertion-free tests and self-comparisons.
- Expected values computed by the code under test, and mocks that implement the asserted behavior.
- String greps of source.
- Tests that break on behavior-preserving refactors.

Keep tests of the public API, protocols, config, migrations, security, and release contracts. A test that is slow or static is no reason to delete it.
