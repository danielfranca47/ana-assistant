import RotinaPage from '@/components/pages/RotinaPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function Page() {
  return (
    <ProtectedRoute>
      <RotinaPage />
    </ProtectedRoute>
  )
}
