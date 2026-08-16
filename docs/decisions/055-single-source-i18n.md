# ADR 055: Supported locales have one shared source of truth

**Status:** accepted

The supported locale list and labels are defined in `@mandys/i18n`. Applications and domain validation consume that shared list rather than maintaining independent locale arrays where possible.
