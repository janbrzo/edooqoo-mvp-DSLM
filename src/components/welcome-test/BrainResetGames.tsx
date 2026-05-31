import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrainResetGame } from "./BrainResetGame";
import { BrainResetReactionGame } from "./BrainResetReactionGame";
import { BrainResetSequenceGame } from "./BrainResetSequenceGame";

/**
 * BrainResetGames — orchestrator for the 3 language-free minigames
 * shown on the Welcome Test pause screen. Default tab is randomized so
 * students get variety across pauses.
 */
const TABS = ["memory", "reaction", "sequence"] as const;
type Tab = (typeof TABS)[number];

export function BrainResetGames() {
  const [tab, setTab] = useState<Tab>(() => TABS[Math.floor(Math.random() * TABS.length)]);

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Quick brain reset · Pick a game</p>
        <p className="text-xs text-muted-foreground">
          No English required — just relax for a minute.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="reaction">Reaction</TabsTrigger>
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
        </TabsList>
        <TabsContent value="memory" className="mt-3">
          <BrainResetGame />
        </TabsContent>
        <TabsContent value="reaction" className="mt-3">
          <BrainResetReactionGame />
        </TabsContent>
        <TabsContent value="sequence" className="mt-3">
          <BrainResetSequenceGame />
        </TabsContent>
      </Tabs>
    </div>
  );
}