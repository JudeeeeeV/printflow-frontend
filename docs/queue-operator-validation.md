# Queue operator validation

Use prepared development data with at least 30 orders, duplicate titles,
different customers, long Unicode filenames, both payment methods, all three
paper sizes, and examples of each print-attempt status. Do not use production
orders to measure usability.

Repeat the same tasks on the baseline and the completed queue:

1. Locate a specified same-day order using filename, customer and full reference.
2. Select three A4 orders spread across pages, filter them out, then review all
   three and remove one. Close review and confirm selection remains intact.
3. Try adding a Long order to that A4 batch and exceeding 25 selections.
4. Review an agent batch, remove its printer, and explicitly choose a replacement.
5. Change payment eligibility in another session during review; confirm the
   affected row is identified and no subset is sent.
6. Simulate a lost send response and reload; recover the original request rather
   than creating another batch.
7. Start manual production, verify downloads leave output unconfirmed, then use
   the existing output and handover/collection controls.
8. Find closed financial follow-up in New Orders and settled closed work in
   Order History. Check unclaimed work stays in Pickup.

Record operator, task, baseline/change version, correct selection count, wrong
selections, elapsed seconds, batch-preparation mistakes and observed errors.
Use the same records and task order for comparison. No improvement should be
claimed without these measurements.

## Device and accessibility matrix

Inspect widths 375, 768, 1024 and 1440 pixels. At desktop, check both short and
tall windows. Verify 3/4/3-or-6 live card capacities, page anchoring, complete
controls, no horizontal page overflow, and readable History rows. Repeat with
larger text and reduced motion.

Use only the keyboard to switch tabs, filter, select, open/close details, copy
a full reference, remove review rows and confirm. Check initial focus, Tab and
Shift+Tab containment, Escape before submission, blocked dismissal during send,
and restoration of focus after dialogs close.

Automated component and database tests cover logical behavior. Browser/device
inspection and human task timing must be recorded separately; they are not
established by a passing build or these written instructions.

## Local automated results — 2026-11-09

- Frontend: 291 tests passed, including review, recovery and selection races.
- Backend: 563 tests passed; five application-security regressions passed.
- Queue, payment, print-attempt, merged-workflow, submission-operation and
  security migration checks passed in isolated PGlite databases.
- Frontend, backend and admin builds passed. Targeted production/new-test
  ESLint checks and repository whitespace checks passed.
- The stale-draft security fixture was updated to exercise the current
  idempotent operation commit while retaining its version-conflict assertion.
- Responsive capacities and dialog behavior have automated coverage. Actual
  browser/device inspection and human task timings remain unrecorded.
- Browser inspection was attempted, but the computer-use inventory reported
  `The browser access host is unavailable`; no visual device checks were claimed.
- No target database migrations or deployment were performed. Existing frontend
  Git merge/index state was preserved; conflict markers were removed from the
  working source files without staging or committing them.

### Audit follow-up

- Order detail classification, receipt and file data now use one database snapshot.
- Failed detail refreshes disable payment and shop decisions; changed print settings
  require renewed evidence confirmation.
- Closing resolved batch recovery clears the parent request before review reopens.
- Accepted manual batches report download failures separately and recover downloads
  using their existing request ID.
- Recovery safely releases unclaimed requests abandoned for 15 minutes; accepted
  attempts cannot be released or duplicated.
- Title sorting matches trimmed visible titles and places unavailable metadata last.
- Tab switches remeasure the grid, History ignores superseded detail requests, and
  document previews use modal focus handling and reduced-motion transitions.
- No pushes, pulls, staging, commits, or merge completion were performed.

## Smoke follow-up — 2026-11-09

- Backend loopback HTTP smoke: nine scenarios passed against disposable PGlite,
  real controllers/services/guards/SQL and simulated auth/storage/agent transport.
- Frontend delivery: three HTML routes and eight modules returned successfully
  from a temporary Vite server. This does not establish successful UI rendering.
- Queue, batch review, payment review, details and fulfillment: 75 regressions passed.
- Agent printer-option and journal checks: 20 regressions passed; no real printing.
- Temporary servers closed; no configured remote database or production orders changed.
- Browser host remains unavailable, so device layouts and manual interactions
  still require browser inspection.
- The three frontend conflict resolutions were staged in the preceding step at
  the user's explicit request. No commit, branch, push, pull or merge completion.
