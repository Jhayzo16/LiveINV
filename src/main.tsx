import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/montserrat'
import './styles/globals.css'
import './styles.css'
import './animations.css'
import './theme.css'
import './globe-topology.css'
import './hospital-building.css'
import './floor-map.css'
import './module-pages.css'
import './typography.css'
import './ui-fixes.css'
import './sidebar.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
