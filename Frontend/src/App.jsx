import { Routes, Route, Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import Chatbot from "./components/Chatbot";
import Home from "./pages/Home";
import QuienesSomos from "./pages/QuienesSomos";
import Contacto from "./pages/Contacto";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import Empleado from "./pages/Empleado";
import Cliente from "./pages/Cliente";
import ProtectedRoute from "./components/ProtectedRoute";

function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
      <WhatsAppButton />
      <Chatbot />
    </>
  );
}

function App() {
  return (
    <Routes>
      {/* Rutas públicas: mantienen navbar, footer y WhatsApp */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/quienes-somos" element={<QuienesSomos />} />
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/login" element={<Login />} />
        <Route path="/restablecer-password" element={<ResetPassword />} />
      </Route>

      {/* Rutas de panel: layout propio, sin navbar público ni WhatsApp */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute rolesPermitidos={[1]}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/empleado"
        element={
          <ProtectedRoute rolesPermitidos={[1, 2]}>
            <Empleado />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente"
        element={
          <ProtectedRoute rolesPermitidos={[3]}>
            <Cliente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pago/resultado"
        element={
          <ProtectedRoute rolesPermitidos={[3]}>
            <Cliente />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
