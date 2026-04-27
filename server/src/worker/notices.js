export const NOTICES = [
  'Hold on, working on it',
  'Percolating the flux capacitor',
  'Crunching the numbers',
  'Warming up the neural pathways',
  'Consulting the oracle',
  'Aligning the cosmic rays',
  'Tuning the parameters',
  'Thinking it through',
  'Just a moment longer',
  'Almost there',
  'Processing the request',
  'Synthesizing the response',
  'Gathering the components',
  'Assembling the pieces',
  'Calibrating the system',
]

export function getRandomNotice() {
  const index = Math.floor(Math.random() * NOTICES.length)
  return NOTICES[index]
}
