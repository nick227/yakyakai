import { intelligenceRoutes } from './routes/intelligenceRoutes.js'
import { memoryRoutes } from './routes/memoryRoutes.js'
import { dashboardRoutes } from './routes/dashboardRoutes.js'
import { exportRoutes } from './routes/exportRoutes.js'
import { recoveryRoutes } from './routes/recoveryRoutes.js'

app.use('/api/intelligence', intelligenceRoutes)
app.use('/api/memory', memoryRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/recovery', recoveryRoutes)
