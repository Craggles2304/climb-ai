# TFT Roll Lab model sanity checks

Patch baseline: Set 18 / 18.2.

- Level 8 4-cost tier odds: 30% per shop slot.
- 4-cost bag size: 10 copies per champion, 14 distinct 4-costs in the standard pool model.
- Example: own 3 target copies, nobody else holds the target, no other 4-costs entered as removed.
  - Target copies left: 7.
  - Known 4-cost pool left: 137.
  - Approx target chance per slot before the next hit: 0.30 × 7/137 ≈ 1.53%.
  - Approx chance of at least one target in one five-slot shop: 1 − (1 − 0.0153)^5 ≈ 7.4%.

The implementation then updates the target numerator after each target hit. Non-target lobby purchases/sales are represented only when the user enters them through `otherSameCostCopiesOut`.
