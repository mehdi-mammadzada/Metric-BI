# Unified KPI period selection

## User-facing outcome
KPI İzlənməsi, Nəticələr və Bonuslar modullarında əvvəlcə dövrlük seçiləcək, sonra həmin dövrlüyə uyğun konkret gün/həftə/ay/rüb/6 aylıq dövr/il və ya custom tarix aralığı seçiləcək. Seçilmiş dövr üzrə siyahılar və göstəricilər işlək şəkildə süzüləcək.

## Implementation
- Extend the shared KPI period selector with the seven required periodicities: günlük, həftəlik, aylıq, rüblük, 6 aylıq, illik və custom.
- Replace duplicated period controls in KPI Results and Bonuses with the shared selector while preserving existing calculation, labels, and exports.
- Add the same dependent selector to manager KPI tracking views and make own, subordinate, and review data respect the selected date range/frequency where card metadata is available.
- Keep existing UI styling and business flows unchanged apart from the requested period behavior.

## Technical details
- Use a structured period value with start/end dates for overlap filtering.
- Normalize ISO and displayed dates before comparing ranges.
- Preserve compatibility with existing KPI card creation/custom-period consumers.
- Validate with the project’s automated build/type checks after edits.