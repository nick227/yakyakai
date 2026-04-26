export function createRuntimeState({originalPrompt='',recentPrompts=[],recentCategories=[],steering=[],discoveries=[]}={}){
 return {
  originalPrompt,
  recentPrompts: recentPrompts.slice(-10),
  recentCategories: recentCategories.slice(-10),
  steering: steering.slice(0,5),
  discoveries: discoveries.slice(-10)
 }
}
