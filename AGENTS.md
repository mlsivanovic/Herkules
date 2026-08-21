# Herkules

## Git

After finishing a task that changes the git working tree (feature, fix, refactor, or follow-up that should ship):

1. Stage only the files that belong to that task.
2. Commit with a message that matches this repo's existing style (imperative, specific).
3. `git push` to the tracked remote immediately. Do not wait to be asked.

Skip the push only if there is nothing to commit/push, the user explicitly said not to, or the work is still incomplete or blocked.
