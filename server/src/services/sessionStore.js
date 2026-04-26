const sessions = new Map();
export function getSession(id){ return sessions.get(id); }
export function upsertSession(id,data){
  sessions.set(id,{...(sessions.get(id)||{}),...data,updatedAt:Date.now()});
  return sessions.get(id);
}
