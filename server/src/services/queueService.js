class QueueService {
  constructor(){ this.jobs=[]; this.running=false; }
  enqueue(job){ this.jobs.push({status:'queued',...job}); return this.jobs.length; }
  next(){ return this.jobs.find(j=>j.status==='queued'); }
  async run(handler){
    if(this.running) return;
    this.running=true;
    while(true){
      const job=this.next();
      if(!job) break;
      job.status='running';
      try { await handler(job); job.status='complete'; }
      catch(e){ job.status='failed'; job.error=String(e); }
    }
    this.running=false;
  }
}
export const queueService = new QueueService();
