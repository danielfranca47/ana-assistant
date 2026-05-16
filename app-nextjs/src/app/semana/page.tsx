import SemanaPage from '@/components/pages/SemanaPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function Page() {
  return (
    <ProtectedRoute>
      <SemanaPage />
    </ProtectedRoute>
  )
}
