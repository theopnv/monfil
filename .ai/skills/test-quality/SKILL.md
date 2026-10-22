---
name: test-quality
description: Improve Monfil's tests with Stryker mutation results. Use when asked to audit, strengthen, clean up, or prune tests for a file or folder under src/, or to raise its mutation score.
---

# Improve tests with mutation results

Read `doc/src/content/docs/contributor-guide/mutation-testing.md` for the commands and the meaning of each status. This skill works on one path at a time: a file or a folder under `src/`. Ask for a path if the request has none, or take the first files of `.mutation/worklist.md`.

The goal is tests that fail when the behavior breaks. Do not change the behavior of the source code. If a survivor shows a real bug, add a test that fails for it, stop, and report it to the user.

## 1. Measure

```bash
npm run mutate -- <path>
```

```bash
npm run mutate:worklist -- <path>
```

Read `.mutation/worklist.md`. Write down the score, the number of survivors, and the number of mutants without coverage for each file. You compare them at the end.

A renderer path runs in Chromium and takes about 7 seconds for each mutant, so keep a renderer path to one folder of a few files. A node path of 25 files takes about 7 minutes.

## 2. Kill the survivors

Work on one source file at a time, with the most undetected mutants first. For each survivor, read the source line and the tests that cover it. Then take one action:

- **Weak assertion.** The test runs the line but does not check its result. Make the existing assertion exact, for example `toEqual` with the full value in place of `toBeDefined` or `toHaveLength`.
- **Missing case.** No test gives an input where the mutant changes the output, such as a boundary value or the other side of a condition. Add that case to the test that covers this behavior. Use `it.each` when several inputs share one check.
- **Equivalent mutant.** No input can change the observable behavior. Add `// Stryker disable next-line <Mutator>: <reason>` above the line. The reason says why no test can see the change. The lint rule `mutation/stryker-disable` refuses a disable without a reason or with `all`.
- **Text that is not a contract.** A `StringLiteral` survivor in a log line or in a message that no caller reads is not worth a test. Leave it, and do not add a disable for it.

Test observable behavior through the public function of the module. Do not export a private helper or spy on internals only to kill a mutant. Follow the test rules in `AGENTS.md`: `// Arrange`, `// Act`, `// Assert`, and `vi.mock(import('./module.ts'))` for module mocks.

## 3. Cover the code that no test runs

For each mutant without coverage, decide if the code has a behavior that a unit test can check. If yes, add the test. If the code only wires the app together, such as IPC registration or window setup, check `npm run coverage:merge` to see if the e2e suite covers it, and leave it.

## 4. Review the tests that add nothing

The work list has two lists of tests. Use them as candidates for review. They are not lists of tests to delete.

- **Tests that kill no mutant.** Read what the test asserts. If it asserts nothing, or only that a value exists, make it exact or remove it. If it checks a rejection, an empty result, or an error path, it can still guard behavior that no mutant reaches. Keep it, unless another test checks the same input and result.
- **Tests without a unique kill.** Another test kills each of its mutants. Remove or merge it only when another test checks the same behavior. Name that test in the commit message.

After you remove or merge tests, run `npm run mutate -- <path>` again. The number of detected mutants must not go down. If it goes down, put the test back.

## 5. Verify and commit

```bash
npm run mutate -- <path>
```

```bash
npm run mutate:worklist -- <path>
```

Run the changed test files with `npx vitest run --project node <files>` or `npx vitest run --config=vitest.browser.config.mts <files>`, and run `npm run lint`. Commit with the type `test` and a lowercase subject, for example `test(feed): kill survivors in the rss parser`. The commit body gives the score before and after, and each removed or merged test with the test that replaces it.

## 6. Report

Tell the user, for each file: the score before and after, the survivors that are left and why, the disables you added, and the tests you removed or merged. Name any bug that you found and did not fix.
