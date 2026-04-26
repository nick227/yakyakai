export function createInitialBatch(originalPrompt=''){
 const cats=['build','copy','pricing','seo','sales']
 return cats.map((category,i)=>({
   title:`${category} task ${i+1}`,
   category,
   prompt:`For this request: ${originalPrompt}\nProduce a valuable ${category} deliverable with specifics.`,
   priority:i+1
 }))
}
