import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor: unwrap the ApiResponse<T> wrapper
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success) {
        return Promise.reject(new Error(body.message ?? 'API error'))
      }
      response.data = body.data
    }
    return response
  },
  (error) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'Network error'
    return Promise.reject(new Error(message))
  }
)

export default apiClient
