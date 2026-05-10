---
name: Quick Add Note from Overview tab
description: Add Note CTA in StudentPage Overview opens a local StudentKnowledgeQuickAddModal instead of navigating to DSLM
type: feature
---
`StudentPage.tsx` Recent Notes section's **Add Note** button opens `StudentKnowledgeQuickAddModal` inline (state `quickAddOpen`). It does NOT call `handleTabChange('knowledge')`.

The **View All** button still navigates to the DSLM Profile tab (intent = browse all notes).

On save, `studentKnowledge.refetch()` is called and the modal closes. Behavior matches v6.9.8 quick-capture: stored as `category='Notes'`, AI classifier reclassifies in the background.

**Sanctity**: Do not re-route Add Note through DSLM tabs — the previous behavior (`redirectMap` to `?tab=dslm&view=profile`) opened nothing and was reported as a dead button.