# ADR 025: Transactional money uses integer minor units

**Status:** accepted

Prices and budgets in the application data model use integer minor units such as euro cents. This avoids floating-point arithmetic for transactional amounts.

Future currency conversion and accounting integrations must preserve currency code alongside values and must not infer a currency from presentation locale.
