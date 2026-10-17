---
name: wrap
description: End-of-session wrap for CaveRunner Grem. Checks that the docs let a fresh session carry on seamlessly, fixes any gaps, commits them, and prints a kick-start prompt that starts the next session as the delegating project manager.
---

# /wrap — hand the project over to a fresh session

The owner runs this at the end of a session. Do every step without asking, and keep the chat output short.

1. **Check the work is safe.**
   - No agent may be running with uncommitted work. If one is, stop and tell the owner.
   - Run `git status --short`. Untracked files under `tests/` or `tools/` belong to the work: commit them. Delete stray
     probes (`tests/logic/_*.js`).
   - If src/ has changed but not been released, say so in the final message. A bug fix gets a fix and a release. Unshown
     looks go to the owner, who must OK them first.
2. **Check the docs a fresh session reads.** Fix any gap you find.
   - `HANDOVER.md`'s **Start here** line names the current version (`src/version.js`), says what is waiting on the
     owner, and gives the right `version.txt` check value.
   - `CHANGELOG.md` has an entry for every released version, newest first.
   - The version line in `CLAUDE.md` matches `src/version.js`.
   - Every `src/` folder touched since the last wrap has an up-to-date README (`git log --stat` since the last wrap
     commit).
   - Every new Dev knob is in `src/dev/knobs.js` (a default plus a row).
   - `PM.md` still matches how the owner wants the project run. If the owner gave new rules or changed a rule this
     session, write them into its rules.
   - Rewrite `PM.md`'s **Last session** section: the date; what was released (versions, one line each); what is
     pending or waiting on the owner (shots sent and not OK'd, half-built stages committed as "not released", and
     which agent knew that code); and the next step.
3. **Save memory.** Save anything non-obvious the owner said about how they work to memory, if it isn't already there.
4. **Commit the doc changes** with the message `docs: wrap <date>` and the attribution lines, then `git push origin grem`.
   - Docs alone need no version bump.
   - Never push unreleased src/ changes along with them. If any exist, commit only the docs.
5. **Report.** Reply with at most 3 lines on what you fixed, then the kick-start prompt below in a code block, filled in.

## Kick-start prompt (fill the braces)

```
You are the PROJECT MANAGER for CaveRunner Grem (this repo, branch `grem`, live at /CaveRunner/grem/).
Read PM.md first — it holds my binding rules, the agent brief template, the release steps and where we left off —
then CLAUDE.md and HANDOVER.md's "Start here" line. Nothing else until a task needs it.
You manage, agents build: small changes yourself, a new stage to ONE sub-agent at a time (20-min box, stop rule,
≤2 shot rounds, no releases by agents), checked every ~10 min. Anything I'll see comes to me as 412×880 screenshots
first; you release only after my OK. Keep messages to 2–5 lines.
Where we are: {version live; pending items, or "nothing pending"}.
{My next list goes here, or: "Wait for my next list."}
```
