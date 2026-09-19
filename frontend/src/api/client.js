import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const client = axios.create({
  baseURL: API_URL,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('tg_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Backend returns relative paths for saved images (e.g. "/api/uploads/x.jpg")
// — resolve against the API origin, not the frontend's own origin.
export function mediaUrl(path) {
  if (!path) return null
  return `${API_URL}${path}`
}

export default client
