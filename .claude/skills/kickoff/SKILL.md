---
name: kickoff
description: Use when the challenge brief just arrived or the team has no plan yet — turns the brief into one chosen idea, a minimal architecture, task split, and docs/PLAN.md within ~45 minutes.
---

# Kickoff (brief → plan in 45 min)

**Never start coding before steps 1–4 are written down.** Time-box: 45 min total.

1. **Brief (5 min).** Paste the brief into `docs/CHALLENGE.md`. Extract: who the user is, the problem, judging criteria, hard constraints (data, tech, time). Write unknowns as questions for the organisers.
2. **Diverge (10 min).** Propose 3 distinct ideas (one line each: user · pain · magic moment). Include one "boring but certain" and one "ambitious".
3. **Converge (5 min).** Pick ONE by: fits judging criteria · demoable in 5 min · buildable in ≤4 h by this team · has one wow moment. Record the choice and rejected ideas in `docs/DECISIONS.md` (decision, why, alternatives).
4. **Architecture (10 min).** Smallest thing that works: ≤ 3 components, one language if possible, managed services over self-hosting. Draw an ASCII data flow. Fill `docs/STACK.md` (install, run, test, deploy commands).
5. **Walking skeleton first.** Task 1 = deployable hello-world through the whole stack (see `rapid-prototype`, `deploy-fast`).
6. **Split (10 min).** Cut into vertical slices, each ≤ 45 min, each demoable. Assign owners + folders in `docs/TEAM.md`. Create GitHub issues (`gh issue create`) from the slice list. Mark the **cut line**: what we drop first if behind at 17:30.
7. **Write `docs/PLAN.md`:** idea · user · wow moment · architecture · slices with owners · cut line · demo story.

**Done when:** PLAN.md exists, every human has a first task, the walking-skeleton task is running.
**Avoid:** scope creep, picking tech for CV reasons, building infra, debating > 10 min.
