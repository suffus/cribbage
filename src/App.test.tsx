import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App';

test('renders the splash with Play', () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );

  expect(screen.getByRole('heading', { name: /CribbageX/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument();
  expect(screen.getByText(/the same shuffle at every difficulty/i)).toBeInTheDocument();
});
