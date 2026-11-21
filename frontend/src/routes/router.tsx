import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppLayout } from '../components/AppLayout'
import { AboutPage } from '../pages/AboutPage'
import { GamesPage } from '../pages/GamesPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SessionsPage } from '../pages/SessionsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'games', element: <GamesPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
