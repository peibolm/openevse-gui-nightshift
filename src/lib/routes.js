import Dashboard from '../routes/Dashboard.svelte'
import Schedule from '../routes/Schedule.svelte'
import Monitoring from '../routes/Monitoring.svelte'
import History from '../routes/History.svelte'
import NotFound from '../routes/NotFound.svelte'

export const routes = {
  '/': Dashboard,
  '/schedule': Schedule,
  '/monitoring': Monitoring,
  '/history': History,
}

export { NotFound }
