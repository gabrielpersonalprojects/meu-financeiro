import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { UIProvider } from "./components/UIProvider";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UIProvider>
    <App />
      </UIProvider>
  </React.StrictMode>
)

