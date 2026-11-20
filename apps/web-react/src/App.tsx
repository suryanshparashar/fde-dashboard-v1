import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import PastViewBanner from './components/PastViewBanner';
import { HyperScalerView, Overview } from './pages/Views';
import People from './pages/People';
import Upload from './pages/Upload';
import Uploads from './pages/Uploads';
import ImportSummary from './pages/ImportSummary';

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <PastViewBanner />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/hs/:name" element={<HyperScalerView />} />
          <Route path="/people" element={<People />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/uploads" element={<Uploads />} />
          <Route path="/uploads/:id" element={<ImportSummary />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
