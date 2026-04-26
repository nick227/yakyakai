import { prisma } from '../db/prisma.js'

export async function saveRunProgress(sessionId, data={}){
  return prisma.aiSession.update({
    where:{ id:sessionId },
    data:{
      status:data.status || undefined,
      promptCount:data.promptCount ?? undefined
    }
  })
}

export async function getResumeState(sessionId){
  return prisma.aiSession.findUnique({
    where:{ id:sessionId }
  })
}
