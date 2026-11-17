# Community content scope — 2026-11-17

Community indices are the core product. The operator chose bounded public-list sampling and actual title/direct-link display for DCInside, Blind, Ppomppu and Toss. Existing terms restrictions remain documented in the worker review manifest; this is an operational scope decision, not a license, partnership or legal compliance finding. robots.txt path checks, request guards and technical access limits still apply. No login, challenge bypass, proxy rotation or detail fetching is added.

The worker classifies transient listing text in memory. It retains only numeric six-hour sentiment buckets and dedupe hashes, plus a separate six-hour retry queue containing actual titles/URLs and numeric results. It does not persist source bodies, listing previews, author profiles or rewritten titles. A failed/unselected raw analysis input is discarded; a later public-list sample can retry it. The daily AI budget and source-balanced sampling remain in place.

The web computes community/world/scoped indices from numeric aggregates. Title links are a separate feed and cannot be counted twice. Empty directional samples do not cast a neutral vote in the overall index. Source display requires the explicit display mode and review cutoff. Ingest validates source/URL hosts and rejects nonempty bodies; DB constraints reject bodies, rewritten titles and other hosts too.

Title/link records and linked per-post results expire after 24 hours, with cleanup at 03:00 and 15:00 KST (up to about 12 hours after expiry). Numeric replay and analysis reports retain the previous seven-day policy. Existing historical replay evidence is removed while numeric frames remain. Accounts, chat and public market/KIS paths are unchanged.

Pending terms/privacy versions are replaced with new published versions while preserving history and at least seven days' notice. Effective date remains 2026-11-25 KST when published on November 17. Provider-side AI logs/backups are not claimed to be immediately deleted.
