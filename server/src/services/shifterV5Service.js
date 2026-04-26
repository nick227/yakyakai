export function createShiftBatch(state){
 const all=['trust','ops','analytics','retention','research','sales','seo']
 const used=new Set(state.recentCategories||[])
 return all.filter(x=>!used.has(x)).slice(0,4).map((category,i)=>({
   title:`${category} shift ${i+1}`,
   category,
   prompt:`Original request: ${state.originalPrompt}. Avoid recent topics: ${(state.recentCategories||[]).join(', ')}. Produce a useful ${category} deliverable.`,
   priority:i+1
 }))
}
