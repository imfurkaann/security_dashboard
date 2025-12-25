import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import trTR from 'antd/locale/tr_TR';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Vehicles from './pages/Vehicles';
import VehicleRecords from './pages/VehicleRecords';
import AdminVehicleRecords from './pages/AdminVehicleRecords';
import AdminManageVehicles from './pages/AdminManageVehicles';
import AdminVisitorRecords from './pages/AdminVisitorRecords';
import AdminManagerRecords from './pages/AdminManagerRecords';
import AdminIncidentRecords from './pages/AdminIncidentRecords';
import AdminFireAlarmRecords from './pages/AdminFireAlarmRecords';
import AdminManagePersonnel from './pages/AdminManagePersonnel';
import AdminManageManagers from './pages/AdminManageManagers';
import AdminExportData from './pages/AdminExportData';
import AdminStatistics from './pages/AdminStatistics';
import Visitors from './pages/Visitors';
import VisitorRecords from './pages/VisitorRecords';
import Managers from './pages/Managers';
import ManagerRecords from './pages/ManagerRecords';
import Incidents from './pages/Incidents';
import IncidentRecords from './pages/IncidentRecords';
import FireAlarms from './pages/FireAlarms';
import FireAlarmRecords from './pages/FireAlarmRecords';
import Sgk from './pages/Sgk';
import EquipmentCheck from './pages/EquipmentCheck';

function App() {
  return (
    <ConfigProvider locale={trTR}>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Equipment Check - Semi-protected (requires login but before dashboard) */}
            <Route path="/equipment-check" element={
              <ProtectedRoute>
                <EquipmentCheck />
              </ProtectedRoute>
            } />

            {/* Admin Protected Routes */}
            <Route path="/admin/dashboard" element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/vehicle-records" element={
              <AdminProtectedRoute>
                <AdminVehicleRecords />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/manage-vehicles" element={
              <AdminProtectedRoute>
                <AdminManageVehicles />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/visitor-records" element={
              <AdminProtectedRoute>
                <AdminVisitorRecords />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/manager-records" element={
              <AdminProtectedRoute>
                <AdminManagerRecords />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/incident-records" element={
              <AdminProtectedRoute>
                <AdminIncidentRecords />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/fire-alarm-records" element={
              <AdminProtectedRoute>
                <AdminFireAlarmRecords />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/manage-personnel" element={
              <AdminProtectedRoute>
                <AdminManagePersonnel />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/manage-managers" element={
              <AdminProtectedRoute>
                <AdminManageManagers />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/export-data" element={
              <AdminProtectedRoute>
                <AdminExportData />
              </AdminProtectedRoute>
            } />
            <Route path="/admin/statistics" element={
              <AdminProtectedRoute>
                <AdminStatistics />
              </AdminProtectedRoute>
            } />

            {/* Protected Routes - Authentication gerekli */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/vehicles" element={
              <ProtectedRoute>
                <Vehicles />
              </ProtectedRoute>
            } />
            <Route path="/vehicle-records" element={
              <ProtectedRoute>
                <VehicleRecords />
              </ProtectedRoute>
            } />
            <Route path="/visitors" element={
              <ProtectedRoute>
                <Visitors />
              </ProtectedRoute>
            } />
            <Route path="/visitor-records" element={
              <ProtectedRoute>
                <VisitorRecords />
              </ProtectedRoute>
            } />
            <Route path="/managers" element={
              <ProtectedRoute>
                <Managers />
              </ProtectedRoute>
            } />
            <Route path="/manager-records" element={
              <ProtectedRoute>
                <ManagerRecords />
              </ProtectedRoute>
            } />
            <Route path="/incidents" element={
              <ProtectedRoute>
                <Incidents />
              </ProtectedRoute>
            } />
            <Route path="/incident-records" element={
              <ProtectedRoute>
                <IncidentRecords />
              </ProtectedRoute>
            } />
            <Route path="/fire-alarms" element={
              <ProtectedRoute>
                <FireAlarms />
              </ProtectedRoute>
            } />          <Route path="/fire-alarm-records" element={
              <ProtectedRoute>
                <FireAlarmRecords />
              </ProtectedRoute>
            } />          <Route path="/sgk" element={
              <ProtectedRoute>
                <Sgk />
              </ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 404 - Bulunamayan sayfalar */}
            <Route path="*" element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                  <p className="text-gray-400 mb-4">Sayfa bulunamadı</p>
                  <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
                    Ana sayfaya dön
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </Router>
      </ThemeProvider>
    </ConfigProvider>
  );
}

export default App;
