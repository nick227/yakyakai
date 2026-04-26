const banned=['brainstorm','overview','basics','benefits','general'];
const hv=['strategy','architecture','pricing','market','implementation','operations','risk','conversion','metrics','workflow','analysis'];

export function scorePlannerTask(task={}, siblings=[]){
 const text=[task.title,task.value,task.prompt].filter(Boolean).join(' ').toLowerCase();
 let score=60; const issues=[];
 if(text.length<80){score-=20;issues.push('too_short')}
 if(banned.some(x=>text.includes(x))){score-=30;issues.push('generic')}
 let bonus=0; hv.forEach(x=>{if(text.includes(x)) bonus+=6})
 score+=Math.min(30,bonus);
 for(const sib of siblings){
   const s=String(sib.title||'').toLowerCase();
   if(s && text.includes(s)){score-=10;issues.push('overlap');break;}
 }
 return {score:Math.max(0,Math.min(100,score)),issues};
}

export function refinePlannerTasks(tasks=[]){
 const out=[];
 for(const t of tasks){
   const q=scorePlannerTask(t,out);
   if(q.score>=55) out.push({...t,qualityScore:q.score,issues:q.issues});
 }
 return out.slice(0,7);
}
