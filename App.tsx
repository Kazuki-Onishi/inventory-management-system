
import React, { useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import ItemList from './components/items/ItemList';
import LocationList from './components/locations/LocationList';
import CategoryList from './components/categories/CategoryList';
import InventoryCount from './components/inventory/InventoryCount';
import BulkImport from './components/import/BulkImport';
import LocationBulkImport from './components/import/LocationBulkImport';
import UserPermissions from './components/settings/UserPermissions';
import CatalogManagement from './components/catalog/CatalogManagement';
import VendorManagement from './components/vendors/VendorManagement';
import VendorAssignments from './components/vendors/VendorAssignments';
import Spinner from './components/ui/Spinner';
import { Role } from './types';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const auth = useContext(AuthContext);
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }
  return auth.user ? children : <Navigate to="/login" />;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const auth = useContext(AuthContext);
    if (auth.loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <Spinner />
        </div>
      );
    }
    const hasAdminAccess = auth.user?.isAdmin || auth.hasPermission(Role.Admin);
    return hasAdminAccess ? children : <Navigate to="/" />;
};

const EditorRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const auth = useContext(AuthContext);
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }
  const hasEditorAccess = auth.user?.isAdmin || auth.hasPermission(Role.Editor);
  return hasEditorAccess ? children : <Navigate to="/" />;
};


const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
        <Route path="/items" element={<PrivateRoute><Layout><ItemList /></Layout></PrivateRoute>} />
        <Route path="/catalog" element={
          <EditorRoute><Layout><CatalogManagement /></Layout></EditorRoute>
        } />
        <Route path="/locations" element={<PrivateRoute><Layout><LocationList /></Layout></PrivateRoute>} />
        <Route path="/categories" element={
          <AdminRoute><Layout><CategoryList /></Layout></AdminRoute>
        } />
        <Route path="/vendors" element={
          <EditorRoute><Layout><VendorManagement /></Layout></EditorRoute>
        } />
        <Route path="/vendors/assignments" element={
          <EditorRoute><Layout><VendorAssignments /></Layout></EditorRoute>
        } />
        <Route path="/inventory" element={<PrivateRoute><Layout><InventoryCount /></Layout></PrivateRoute>} />
        <Route path="/import/items" element={
          <AdminRoute><Layout><BulkImport /></Layout></AdminRoute>
        } />
        <Route path="/import/locations" element={
          <AdminRoute><Layout><LocationBulkImport /></Layout></AdminRoute>
        } />
        <Route path="/settings" element={
          <AdminRoute><Layout><UserPermissions /></Layout></AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
