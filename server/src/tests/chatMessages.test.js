import assert from 'node:assert/strict'
import { prisma } from '../db/prisma.js'

async function cleanup() {
  await prisma.chatMessage.deleteMany({})
  await prisma.aiOutput.deleteMany({})
  await prisma.aiSession.deleteMany({})
  await prisma.user.deleteMany({})
}

async function setupTestUser() {
  const bcrypt = await import('bcryptjs')
  const passwordHash = await bcrypt.hash('testpass123', 10)
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
    },
  })
  return user
}

async function testChatMessageCreation() {
  console.log('[test] Testing ChatMessage creation on session start')
  
  await cleanup()
  const user = await setupTestUser()
  
  const session = await prisma.aiSession.create({
    data: {
      userId: user.id,
      title: 'Test Session',
      originalPrompt: 'Test prompt',
      status: 'queued',
      pace: 'steady',
      messages: {
        create: {
          role: 'USER',
          content: 'Test prompt',
        },
      },
    },
  })
  
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })
  
  assert.equal(messages.length, 1, 'Should have 1 message')
  assert.equal(messages[0].role, 'USER', 'Message should be USER role')
  assert.equal(messages[0].content, 'Test prompt', 'Message content should match')
  
  console.log('[test] ✓ ChatMessage creation works')
  await cleanup()
}

async function testAssistantMessageCreation() {
  console.log('[test] Testing ASSISTANT message creation')
  
  await cleanup()
  const user = await setupTestUser()
  
  const session = await prisma.aiSession.create({
    data: {
      userId: user.id,
      title: 'Test Session',
      originalPrompt: 'Test prompt',
      status: 'running',
      pace: 'steady',
      messages: {
        create: {
          role: 'USER',
          content: 'Test prompt',
        },
      },
    },
  })
  
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'ASSISTANT',
      content: '<p>AI response</p>',
      metadata: JSON.stringify({ cycle: 1, index: 0 }),
    },
  })
  
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })
  
  assert.equal(messages.length, 2, 'Should have 2 messages')
  assert.equal(messages[0].role, 'USER', 'First message should be USER')
  assert.equal(messages[1].role, 'ASSISTANT', 'Second message should be ASSISTANT')
  
  console.log('[test] ✓ ASSISTANT message creation works')
  await cleanup()
}

async function testMessagesPagination() {
  console.log('[test] Testing messages pagination')
  
  await cleanup()
  const user = await setupTestUser()
  
  const session = await prisma.aiSession.create({
    data: {
      userId: user.id,
      title: 'Test Session',
      originalPrompt: 'Test prompt',
      status: 'running',
      pace: 'steady',
      messages: {
        create: {
          role: 'USER',
          content: 'Test prompt',
        },
      },
    },
  })
  
  // Create 10 assistant messages
  for (let i = 0; i < 10; i++) {
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: `<p>Response ${i}</p>`,
        metadata: JSON.stringify({ cycle: 1, index: i }),
      },
    })
  }
  
  // Test pagination with limit 5
  const page1 = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  
  assert.equal(page1.length, 5, 'Should return 5 messages')
  
  // Test pagination with before cursor
  const oldestOnPage1 = page1[page1.length - 1]
  const page2 = await prisma.chatMessage.findMany({
    where: {
      sessionId: session.id,
      createdAt: { lt: oldestOnPage1.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  
  assert.equal(page2.length, 5, 'Should return remaining 5 messages')
  
  // Verify chronological order when reversed
  const allMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })
  
  assert.equal(allMessages.length, 11, 'Should have 11 total messages')
  assert.equal(allMessages[0].role, 'USER', 'First should be USER')
  
  console.log('[test] ✓ Messages pagination works')
  await cleanup()
}

async function testSessionCascadeDelete() {
  console.log('[test] Testing cascade delete of messages on session delete')
  
  await cleanup()
  const user = await setupTestUser()
  
  const session = await prisma.aiSession.create({
    data: {
      userId: user.id,
      title: 'Test Session',
      originalPrompt: 'Test prompt',
      status: 'running',
      pace: 'steady',
      messages: {
        create: [
          { role: 'USER', content: 'Test prompt' },
          { role: 'ASSISTANT', content: '<p>Response</p>' },
        ],
      },
    },
  })
  
  const messageCountBefore = await prisma.chatMessage.count({
    where: { sessionId: session.id },
  })
  assert.equal(messageCountBefore, 2, 'Should have 2 messages before delete')
  
  await prisma.aiSession.delete({
    where: { id: session.id },
  })
  
  const messageCountAfter = await prisma.chatMessage.count({
    where: { sessionId: session.id },
  })
  assert.equal(messageCountAfter, 0, 'Should have 0 messages after session delete')
  
  console.log('[test] ✓ Cascade delete works')
  await cleanup()
}

async function runAllTests() {
  try {
    await testChatMessageCreation()
    await testAssistantMessageCreation()
    await testMessagesPagination()
    await testSessionCascadeDelete()
    console.log('\n✅ All chat message tests passed')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    await cleanup()
    process.exit(1)
  }
}

runAllTests()
