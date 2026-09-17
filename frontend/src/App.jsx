import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import About from './pages/About.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import LocationPage from './pages/LocationPage.jsx'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function AppLayout({ children }) {
  return (
    <div className="flex">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout><History /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/location"
        element={
          <ProtectedRoute>
            <AppLayout><LocationPage /></AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
