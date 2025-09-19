
import { ViteReactSSG, ClientOnly } from 'vite-react-ssg';
import './index.css';
import HomePageModern from '@/pages/HomePageModern/HomePageModern.jsx';

const routes = [
  {
    path: '/',
    element: <HomePageModern />,
  },
  {
    path: 'editor/:id',
    lazy: () =>
      import('@/pages/EditorPageModern/EditorPageModern.jsx').then((mod) => ({
        Component: () => <ClientOnly>{() => <mod.default />}</ClientOnly>,
      })),
  },
];

export const createRoot = ViteReactSSG({ routes });
