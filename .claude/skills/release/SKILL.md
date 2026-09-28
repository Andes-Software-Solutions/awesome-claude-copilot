---
name: release
description: "Release the andes marketplace from main: roll CHANGELOG [Unreleased] into a version section, commit, tag vX.Y.Z, push, and publish the GitHub Release with the plugin versions. Maintainer-only; run on request."
argument-hint: "<major|minor|patch|X.Y.Z> [--dry-run]"
allowed-tools: Bash(node:*), Bash(git status:*), Bash(git log:*), Bash(git tag:*), Bash(gh release view:*), Read
---

Run only when the user invoked `/release`. Never start a release on your own initiative.

This is the one maintainer command allowed to commit, tag, and push — and only after the user says yes to the dry run. Plugin versions are not part of a release: they move in the PR that changes a plugin (`repo-audit --base` enforces it). A release is the marketplace event: CHANGELOG roll, tag `vX.Y.Z`, GitHub Release.

## 1. Dry run

```bash
node scripts/release.mjs <major|minor|patch|X.Y.Z> --dry-run
```

The script checks that you are on a clean `main` in sync with `origin/main`, that `gh` is authenticated, that `node scripts/repo-audit.mjs` is clean, and that `claude plugin validate .` passes when the `claude` CLI is available. Branch on the exit code:

- **`2` — a precondition failed.** Report the blocker verbatim and stop. Do not fix it yourself: switching branches, pulling, or "cleaning up" the tree is the user's call.
- **`1` — the script failed.** Report the error and stop.
- **`0`** — show the user, exactly as printed: the version (and the previous tag), the `## [X.Y.Z] - date` section that will be cut from `[Unreleased]`, and the plugin-version table that goes into the release notes.

If the user passed `--dry-run`, stop here.

## 2. Confirm

Ask one question: "Release vX.Y.Z now? This commits the CHANGELOG roll, tags, pushes `main`, and publishes the GitHub Release." Proceed only on an explicit yes. Anything else (silence, "maybe", a follow-up question) means stop and leave the tree untouched.

## 3. Release

```bash
node scripts/release.mjs <same argument>
```

Report the release URL the script prints. If the push succeeded but `gh release create` failed, the script prints the exact command to retry; relay it — never re-run the whole release, the tag already exists.

## What this must never do

- Run on any branch but `main`, or with local changes present. The script refuses; do not work around it.
- Edit `CHANGELOG.md` by hand to "help" the roll. Entries are written by `andes-se-technical-writer` in the PRs; a release only moves them.
- Bump plugin versions. If a plugin changed without a bump, that PR was wrong; fix it in a new PR, then release.
