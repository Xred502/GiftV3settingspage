import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { BackofficeThemeProvider } from "@/contexts/BackofficeThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { giftcardMakerPages } from "@/lib/giftcard-maker";
import Login from "./pages/Login";
import CustomerSelect from "./pages/CustomerSelect";
import Dashboard from "./pages/Dashboard";
import GiftCards from "./pages/GiftCards";
import GiftCardDetails from "./pages/GiftCardDetails";
import TransactionReport from "./pages/TransactionReport";
import GiftcardMaker from "./pages/GiftcardMaker";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <BackofficeThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/select-customer"
                  element={
                    <ProtectedRoute>
                      <CustomerSelect />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/giftcards"
                  element={
                    <ProtectedRoute>
                      <GiftCards />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/giftcard/:id"
                  element={
                    <ProtectedRoute>
                      <GiftCardDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cardholders"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/giftcards" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report"
                  element={
                    <ProtectedRoute>
                      <TransactionReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/giftcard-maker"
                  element={
                    <ProtectedRoute>
                      <GiftcardMaker />
                    </ProtectedRoute>
                  }
                />
                {giftcardMakerPages.map((page) => (
                  <Route
                    key={page.key}
                    path={page.route}
                    element={
                      <ProtectedRoute>
                        <GiftcardMaker />
                      </ProtectedRoute>
                    }
                  />
                ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </BackofficeThemeProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
