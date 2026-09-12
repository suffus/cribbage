import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import App from './App';
import { store } from './app/store';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
      <ToastContainer
        position="top-left"
        autoClose={3000}
        hideProgressBar
        closeOnClick
        pauseOnHover
      />
    </Provider>
  </StrictMode>
);
