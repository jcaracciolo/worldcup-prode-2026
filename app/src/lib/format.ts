/**
 * Display formatting utilities for group/stage names.
 */

/** Format group name: GROUP_A → "Group A" */
export function formatGroupName(group: string | null): string | null {
  if (!group) return null;
  if (group.startsWith("GROUP_")) {
    return `Group ${group.replace("GROUP_", "")}`;
  }
  return group;
}

/** Format stage name for display */
export function formatStageName(stage: string): string {
  const stageNames: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return stageNames[stage] || stage.replace(/_/g, " ");
}
