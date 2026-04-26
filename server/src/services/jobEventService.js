import { prisma } from '../db/prisma.js'

export async function addJobEvent(jobId,type,message='',meta={}){
  return prisma.jobEvent.create({
    data:{
      jobId,
      type,
      message,
      metaJson: JSON.stringify(meta || {})
    }
  })
}
