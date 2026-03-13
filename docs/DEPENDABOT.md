# Dependabot Workflow

## Overview

Dependabot automatically creates PRs for GitHub Actions updates. Due to technical limitations, **Security Updates always target the `main` branch**, while **Version Updates target the `dev` branch**.

**IMPORTANT: Never merge Dependabot PRs directly on `main`!** This would bypass our Git flow.

## Configuration

- **Location**: `.github/dependabot.yml`
- **Schedule**: Weekly (Monday 09:00 CET)
- **Ecosystem**: `github-actions` only (no npm dependencies in this repo)
- **Version Updates Target**: `dev` branch
- **Security Updates Target**: `main` branch (GitHub limitation)

## Worktree Workflow

**All Dependabot updates MUST be processed in a git worktree** to avoid interfering with your current working branch.

A worktree creates an isolated copy of the repository where you can switch branches, build, and test without affecting your main working directory.

### Why Worktrees?

- Your current branch stays untouched (no stashing, no lost context)
- Parallel work: you can continue developing while the update runs
- Clean environment: no risk of mixing dependency changes with feature work
- Easy cleanup: just remove the worktree when done

### Basic Worktree Commands

```bash
# Fetch latest dev and create a worktree from it
git fetch origin dev
git worktree add .worktrees/dependabot-<action-name> origin/dev
cd .worktrees/dependabot-<action-name>

# ... do the update work (upgrade, build, test, commit, push) ...

# Return to main working directory and clean up
cd -
git worktree remove .worktrees/dependabot-<action-name>
```

**Note:** The `.worktrees/` directory is gitignored and used exclusively for temporary worktrees.

## PR Types

### Security Updates (against main)

Dependabot creates these PRs against `main` with the label `security`.

**Examples:**
- Critical security vulnerabilities in GitHub Actions
- CVE fixes in action dependencies

**DO NOT merge directly on main!**

### Version Updates (against dev)

Dependabot creates these PRs against `dev` for regular updates.

**Categories:**
- **Patch**: Bug fixes (v4.1.0 → v4.1.1)
- **Minor**: New features (v4.1.0 → v4.2.0)
- **Major**: Breaking changes (v4.1.0 → v5.0.0)

## Review Process

### Step 1: Identify PR Type

Check the base branch:
- **Base: main** → Security Update (follow security process)
- **Base: dev** → Version Update (follow version process)

### Step 2: Review Changes

**Quick Check:**
```bash
gh pr view <number> --json files --jq '.files[].path'
```

**Only workflow files changed?**
- Low risk
- Quick review sufficient

**Action pinned to new SHA?**
- Verify the SHA matches the tagged release
- Check the action's release notes

### Step 3: Check Changelog

**In PR description:**
- Review changelog link
- Look for breaking changes
- Check migration guides

### Step 4: Check CI Status

All checks must pass:
- Build Package: Success

## Security Updates Process (main PRs)

**NEVER merge directly on main!**

### Process

1. **Review PR on main**
   ```bash
   gh pr view <number>
   gh pr checks <number>
   ```

2. **Check severity and changes**
   - High/Critical: Urgent
   - Medium/Low: Can wait for next release

3. **Apply on a feature branch and create PR to dev**

   **IMPORTANT:** Never push directly to `dev` - always use a PR (branch protection enforced).

   **Option A: Manual Update in Worktree (Recommended)**
   ```bash
   # Fetch latest dev and create a worktree with a feature branch
   git fetch origin dev
   git worktree add .worktrees/dependabot-<action-name> -b chore/security-<action-name>-<version> origin/dev
   cd .worktrees/dependabot-<action-name>

   # Update the action SHA in workflow files manually
   # Verify the new SHA matches the tagged release

   # Build and test
   chmod +x build.sh
   cp package/js/config.example.js package/js/config.js
   ./build.sh

   # Commit
   git add .github/workflows/
   git commit -m "chore(deps): bump <action-name> to <version> (security fix)

   Fixes [vulnerability description]

   Addresses Dependabot PR #<number>"

   # Push feature branch and create PR to dev
   git push origin chore/security-<action-name>-<version>
   gh pr create --base dev --title "chore(deps): bump <action-name> to <version> (security fix)" --body "Addresses Dependabot PR #<number>"

   # Clean up worktree
   cd -
   git worktree remove .worktrees/dependabot-<action-name>
   ```

   **Option B: Cherry-pick in Worktree (if compatible)**
   ```bash
   # Fetch latest dev and create a worktree with a feature branch
   git fetch origin dev
   git worktree add .worktrees/dependabot-<action-name> -b chore/security-<action-name>-<version> origin/dev
   cd .worktrees/dependabot-<action-name>

   # Get commit SHA from Dependabot PR
   gh pr view <number> --json commits --jq '.commits[0].oid'

   # Cherry-pick
   git cherry-pick <commit-sha>

   # If conflicts, resolve and continue
   git cherry-pick --continue

   # Push feature branch and create PR to dev
   git push origin chore/security-<action-name>-<version>
   gh pr create --base dev --title "chore(deps): bump <action-name> to <version> (security fix)" --body "Addresses Dependabot PR #<number>"

   # Clean up worktree
   cd -
   git worktree remove .worktrees/dependabot-<action-name>
   ```

4. **Merge PR to dev, then close Dependabot PR on main**
   ```bash
   # Merge the PR to dev (after CI passes)
   gh pr merge <pr-number> --squash --delete-branch

   # Close Dependabot PR on main
   gh pr close <dependabot-pr-number> --comment "$(cat <<'EOF'
   Security fix applied to dev branch via PR #<pr-number>

   Applied via feature branch PR to dev instead of merging directly to main (following our Git flow: dev -> main).

   **PR:** https://github.com/Adlocaite/adlocaite-broadsign/pull/<pr-number>

   **Verification:**
   - Build: Success
   - Security: CVE fixed

   The fix will be promoted through our normal deployment flow:
   1. dev (done)
   2. main (via PR)

   See docs/DEPENDABOT.md for our Dependabot workflow.
   EOF
   )"
   ```

5. **Follow normal Git flow**
   - dev → main (via PR)

### Critical Security Updates

If a vulnerability is actively exploited:

1. Apply to `dev` immediately
2. Fast-track PR to main (same day)
3. Document as hotfix

## Version Updates Process (dev PRs)

These PRs target `dev` directly - much simpler!

### Patch/Minor Updates

**Low risk - Quick review:**

1. Check CI is green
2. Review changelog (optional)
3. Verify SHA matches tagged release
4. Merge directly to dev

```bash
gh pr merge <number> --squash
```

### Major Updates

**High risk - Thorough review:**

1. Review breaking changes thoroughly
2. Check migration guide
3. Test locally (build the package)
4. Update workflow files if needed
5. Merge when ready

**Do NOT auto-merge major updates!**

## Local Testing

For uncertain updates, **always use a worktree**:

```bash
# Fetch the PR branch and create a worktree directly from it
git fetch origin pull/<number>/head:test-pr-<number>
git worktree add .worktrees/test-pr-<number> test-pr-<number>
cd .worktrees/test-pr-<number>

# Build and verify
cp package/js/config.example.js package/js/config.js
chmod +x build.sh
./build.sh

# Verify package
unzip -t adlocaite-broadsign.x-html-package

# Clean up when done
cd -
git worktree remove .worktrees/test-pr-<number>
git branch -D test-pr-<number>
```

## Common Issues

### Merge Conflicts

If Dependabot PR has conflicts with dev:

```bash
# Ask Dependabot to rebase
gh pr comment <number> --body "@dependabot rebase"
```

### Failed CI

If build fails:

1. Check error logs in GitHub Actions
2. Investigate if update caused failure
3. If yes: Close PR and create issue
4. If no: Re-run CI

### "Dependabot Updates" Workflow Failures (False Positive)

You may see failed workflow runs with:
- **Name:** "Dependabot Updates"
- **Event:** `dynamic`
- **Status:** Failed

**Why this happens:**

1. Dependabot runs automatic checks on its schedule (Monday 09:00 CET)
2. Finds security vulnerabilities in action dependencies
3. Attempts to create PRs against `main` (GitHub limitation)
4. We've already manually applied these updates to `dev` and closed the PRs
5. Dependabot fails because updates are already applied

**These failures are harmless and expected:**

- They don't affect your builds or deployments
- They don't indicate actual security issues
- They're a side effect of our manual security workflow
- The actual security fixes are already in place on `dev`

**When to investigate:**

If you see Dependabot failures AND:
- New open Dependabot PRs on `main` that haven't been handled
- Security alerts in GitHub Security tab
- No recent security fix commits on `dev`

Then follow the Security Updates Process above.

## Weekly Routine

Every Monday 09:00 CET, Dependabot creates PRs:

1. **Review all PRs** (spend 5-10 min)
2. **Categorize**: Security vs. Version, Patch vs. Minor vs. Major
3. **Quick wins**: Merge safe patch/minor updates to dev
4. **Security**: Apply to dev, follow Git flow
5. **Major**: Create issues, schedule review

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project overview and development guidelines
- `.github/dependabot.yml` - Dependabot configuration
