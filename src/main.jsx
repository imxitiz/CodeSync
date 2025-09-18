
import { ViteReactSSG, ClientOnly } from 'vite-react-ssg';
import './index.css';
import HomePage from './pages/HomePage/HomePage';

const routes = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: 'editor/:id',
    lazy: () => import('./pages/EditorPage/EditorPage').then(mod => ({ Component: () => (
      <ClientOnly>{() => <mod.default />}</ClientOnly>
    ) })),
  },
];

export const createRoot = ViteReactSSG(
  { routes },
);
