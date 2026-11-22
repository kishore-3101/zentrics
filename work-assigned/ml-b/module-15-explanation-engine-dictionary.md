# Module 15: Explanation Engine and Reason-Code Dictionary

**Owner:** BE (templates & engine) + ML-B (dictionary & SHAP reason codes). **Backup:** FE. **Days:** 1-9. See `plan.md` Section 5.9 and `plan_v2.md` Section 6.

## Goal
Transform raw detector hits, graph structure metrics, and SHAP model outputs into deterministic, auditor-ready, plain-English explanations that bank compliance officers and regulators can immediately understand and act upon without ambiguity.

## Inputs
`schem_changes.md`, detector hit schemas from Module 6, SHAP reason-code outputs from Module 9, ring object definitions from Module 7.

## Deliverables
1. **Canonical Reason-Code Dictionary (`docs/reason_codes.md`)**:
   - Comprehensive dictionary mapping algorithmic anomaly codes and SHAP feature keys to standardized banking compliance narratives.
   - Examples:
     - `BURST_INFLOW_RATIO`: "Inflow velocity anomaly: Received ₹{amount} from {count} distinct senders within {window_min} minutes ({multiplier}x normal baseline)."
     - `CYCLE_DETECTED`: "Circular fund routing: ₹{amount} transferred across {hops} intermediary accounts before returning to origin account within {duration_hours} hours."
     - `RAPID_PASS_THROUGH`: "High-velocity pass-through: {forward_pct}% of inbound funds (₹{amount}) forwarded to destination accounts within {median_delay_min} minutes of receipt."
     - `DORMANT_ACTIVATION`: "Sudden dormancy exit: Account inactive for {dormant_days} days moved ₹{amount} across {txn_count} transactions within {active_hours} hours."
     - `NEIGHBOR_CONTAGION`: "Network proximity risk: Directly transacted with {mule_neighbors} high-risk flagged accounts moving ₹{exposure_amount}."
2. **Deterministic Explanation Generator (`explain_ring`)**:
   - Pure Python/TypeScript engine taking ring facts, member scores, and detector hits, returning structured JSON:
     - `headline`: One-sentence executive finding.
     - `key_facts`: Bulleted list of verifiable facts (exact amounts, timestamps, sender counts, hop counts).
     - `pattern_tags`: Array of standardized tags (e.g. `['rapid_pass_through', 'mule_pooling', 'atm_cashout']`).
     - `recommended_action`: Plain compliance advice based on predefined threshold rules:
       - Score >= 80: "Immediate freeze of all collector and mule accounts; initiate cyber-cell STR/SAR filing."
       - Score 50-79: "Place temporary debit freeze on intermediary accounts; escalate to senior AML analyst."
       - Score < 50: "Enhanced transaction monitoring for 48 hours; request KYC re-verification."
3. **Strict LLM Narrative Rewrite (Optional Polish with Hallucination Guard)**:
   - Optional enhancement taking `key_facts` and compiling a formal institutional SAR narrative.
   - **Mandatory Numerical Validator**: An automated parser checking that *every single number, rupee amount, and account reference* in the LLM response appears verbatim in the structured input facts. If a discrepancy or hallucinated token is detected, it automatically discards the LLM text and falls back to the deterministic template.
4. **Explanation Verification Suite**:
   - Unit tests covering all five ring typologies and mixed topologies.
   - Verifies that explanations contain zero generic placeholders, match accounting sums, and correctly distinguish victim accounts from mule accounts.

## Schedule
- Day 1: ML-B and BE draft the Reason-Code Dictionary based on banking AML compliance standards.
- Day 3: BE builds deterministic explanation template engine v1; tests on Module 2 fixtures.
- Day 7: BE implements optional LLM narrative prompt with strict numerical validator.
- Day 8: Review explanation wording with GR and ML-B to ensure technical and domain accuracy.
- Day 9: **Integration 2** — plug `explain_ring` into backend pipeline runner.
- Day 10: Final explanation quality audit across all rings in `demo` dataset.

## Can start when
Day 1. Domain drafting and template engineering require zero code dependencies.

## Hard dependency
Integration into the live pipeline requires detector outputs from Module 6 and 7.

## Stand-in while blocked
Module 2 JSON ring fixtures.

## Blocks others
Module 11 (pipeline runner calls `explain_ring`) and Module 16 (Analyst Explanation Panel UI).

## Done when
The explanation engine reliably produces clean, concise, grammatically flawless, and factually bulletproof narratives for every ring type, passing 100% of numerical consistency unit tests.

