import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import EquityPage from './features/equity/EquityPage'
import HandDetail from './features/hands/HandDetail'
import HandForm from './features/hands/HandForm'
import HandsPage from './features/hands/HandsPage'
import PracticePage from './features/practice/PracticePage'
import RangesPage from './features/ranges/RangesPage'
import SizingPage from './features/sizing/SizingPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/equity" replace />} />
        <Route path="equity" element={<EquityPage />} />
        <Route path="ranges" element={<RangesPage />} />
        <Route path="sizing" element={<SizingPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="hands" element={<HandsPage />} />
        <Route path="hands/new" element={<HandForm />} />
        <Route path="hands/:id" element={<HandDetail />} />
        <Route path="*" element={<Navigate to="/equity" replace />} />
      </Route>
    </Routes>
  )
}
