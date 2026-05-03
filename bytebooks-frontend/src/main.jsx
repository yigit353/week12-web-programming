import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';

// BrowserRouter owns the URL; AuthProvider owns the user/token state.
// We wrap them in that order so any component inside the router can
// call useAuth(). The router has to be outside AuthProvider only if
// AuthProvider itself uses useNavigate — ours doesn't, so either order
// would work, but putting the router on the outside is conventional.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
