import CalendarioPage from '@/components/pages/CalendarioPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function Page() {
  return (
    <ProtectedRoute>
      <CalendarioPage />
    </ProtectedRoute>
  )
}
