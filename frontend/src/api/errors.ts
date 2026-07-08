import axios from 'axios'

function flattenDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    return detail.map((item) => flattenDetail(item)).join(' ')
  }
  if (detail && typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .map(([field, messages]) => {
        const text = flattenDetail(messages)
        return field === 'non_field_errors' || field === 'detail' ? text : `${field}: ${text}`
      })
      .join(' ')
  }
  return ''
}

export function extractApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    const message = flattenDetail(error.response.data.detail ?? error.response.data)
    if (message) {
      return message
    }
  }
  return fallback
}
