import { adminRoutes } from './routes/adminRoutes.js'
import { jobRoutes } from './routes/jobRoutes.js'

app.use('/api/admin', adminRoutes)
app.use('/api/jobs', jobRoutes)
