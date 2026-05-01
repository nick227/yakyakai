export function emitMetric(name, value, tags = {}) {
  console.info('[metric]', {
    metric: name,
    value,
    ...tags,
    time: new Date().toISOString(),
  })
}

